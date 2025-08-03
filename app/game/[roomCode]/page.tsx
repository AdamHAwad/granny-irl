'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSoundNotifications } from '@/hooks/useSoundNotifications';
import { subscribeToRoom, eliminatePlayer, updatePlayerLocation, clearPlayerLocation } from '@/lib/gameService';
import { Room, Player } from '@/types/game';
import { locationService, HIGH_FREQUENCY_LOCATION_OPTIONS } from '@/lib/locationService';
import AuthGuard from '@/components/AuthGuard';
import LocationPermissionModal from '@/components/LocationPermissionModal';
import InteractiveGameMap from '@/components/InteractiveGameMap';
import ProximityArrow from '@/components/ProximityArrow';

interface PageProps {
  params: {
    roomCode: string;
  };
}

function GamePage({ params }: PageProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const router = useRouter();
  const { playGameStart, playGameEnd, playElimination, playCountdown, vibrate } = useSoundNotifications();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSuccessfulRoom, setLastSuccessfulRoom] = useState<Room | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [headstartRemaining, setHeadstartRemaining] = useState(0);
  const [eliminating, setEliminating] = useState(false);
  const [gameStartSoundPlayed, setGameStartSoundPlayed] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Handle clicking on a player to view their location
  const handlePlayerClick = (playerId: string) => {
    const clickedPlayer = players.find(p => p.uid === playerId);
    
    // Check if current player can view this player
    const canView = currentPlayer?.isAlive && (
      // Eliminated players can see everyone
      !currentPlayer.isAlive ||
      // Killers can see everyone
      currentPlayer.role === 'killer' ||
      // Survivors can see other survivors but not killers
      (currentPlayer.role === 'survivor' && clickedPlayer?.role === 'survivor')
    );

    if (canView && clickedPlayer?.location) {
      setSelectedPlayerId(playerId);
      // The map will handle centering on this player
    }
  };


  // Get current player for boundary checking
  const currentPlayer = room ? room.players[user?.id || ''] : null;

  const handleEliminate = useCallback(async () => {
    if (!user || !room) return;

    setEliminating(true);
    try {
      await eliminatePlayer(params.roomCode, user.id);
      playElimination();
      vibrate([300, 100, 300, 100, 300]);
    } catch (error) {
      console.error('Error eliminating player:', error);
      setEliminating(false);
    }
  }, [user, room, params.roomCode, playElimination, vibrate]);

  const handleGameEnd = useCallback(async () => {
    if (!user) return;
    
    console.log('Game ending, clearing location tracking');
    locationService.stopWatching();
    await clearPlayerLocation(params.roomCode, user.id);
    setLocationEnabled(false);
  }, [user, params.roomCode]);

  useEffect(() => {
    if (!user || !profile) return;

    let isComponentMounted = true;
    let errorTimeout: NodeJS.Timeout | null = null;
    let redirectTimeout: NodeJS.Timeout | null = null;

    const unsubscribe = subscribeToRoom(params.roomCode, (roomData) => {
      if (!isComponentMounted) return;

      if (!roomData) {
        console.log('Room fetch failed, but may be temporary');
        if (!lastSuccessfulRoom) {
          errorTimeout = setTimeout(() => {
            if (isComponentMounted) {
              setError('Room not found');
              setLoading(false);
            }
          }, 3000); // Reduced timeout with paid plan
        }
        return;
      }

      // Clear any pending error timeouts
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }

      setError('');
      setLastSuccessfulRoom(roomData);

      // Check if current user has been kicked from the room
      if (!roomData.players[user.id]) {
        console.log('User has been kicked from game:', user.id);
        setError('You have been removed from this room');
        redirectTimeout = setTimeout(() => {
          if (isComponentMounted) {
            router.push('/');
          }
        }, 2000);
        return;
      }

      setRoom(roomData);
      setLoading(false);

      // Show location modal when game starts (headstart phase)
      if (roomData.status === 'headstart' && !showLocationModal && !locationEnabled) {
        setShowLocationModal(true);
      }

      if (roomData.status === 'waiting') {
        router.push(`/room/${params.roomCode}`);
      } else if (roomData.status === 'finished') {
        handleGameEnd();
        router.push(`/results/${params.roomCode}`);
      }
    });

    return () => {
      isComponentMounted = false;
      if (errorTimeout) clearTimeout(errorTimeout);
      if (redirectTimeout) clearTimeout(redirectTimeout);
      unsubscribe();
    };
  }, [user, profile, params.roomCode, router, showLocationModal, locationEnabled, lastSuccessfulRoom, handleGameEnd]);

  useEffect(() => {
    if (!room) return;

    const updateTimers = () => {
      const now = Date.now();

      if (room.status === 'headstart' && room.headstart_started_at) {
        const headstartEnd = room.headstart_started_at + (room.settings.headstartMinutes * 60 * 1000);
        const remaining = Math.max(0, headstartEnd - now);
        setHeadstartRemaining(remaining);
      }

      if (room.status === 'active' && room.game_started_at) {
        const gameEnd = room.game_started_at + (room.settings.roundLengthMinutes * 60 * 1000);
        const remaining = Math.max(0, gameEnd - now);
        setTimeRemaining(remaining);

        // Play game start sound when transitioning to active
        if (!gameStartSoundPlayed) {
          playGameStart();
          vibrate([200, 100, 200]);
          setGameStartSoundPlayed(true);
        }

        // Play countdown sounds in final 10 seconds
        if (remaining <= 10000 && remaining > 0 && Math.floor(remaining / 1000) !== Math.floor((remaining - 1000) / 1000)) {
          playCountdown();
          vibrate(100);
        }

        // Check if game should end due to timer (only if game has been active for at least 5 seconds)
        if (remaining <= 0 && room.status === 'active' && room.game_started_at && (Date.now() - room.game_started_at) > 5000) {
          console.log('Game timer expired on client side, triggering game end check');
          import('@/lib/gameService').then(({ checkGameEnd }) => {
            checkGameEnd(params.roomCode);
          });
        }
      }

    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [room, gameStartSoundPlayed, playGameStart, playCountdown, vibrate, params.roomCode]);

  const handleLocationPermissionGranted = () => {
    console.log('Location permission granted');
    setLocationEnabled(true);
    setShowLocationModal(false);
    setLocationError('');
  };

  const handleLocationPermissionDenied = (error: string) => {
    console.log('Location permission denied:', error);
    setLocationError(error);
    setShowLocationModal(false);
  };

  const handleLocationSkip = () => {
    console.log('Location permission skipped');
    setShowLocationModal(false);
  };

  // Location tracking effect with optimization
  useEffect(() => {
    console.log('Location tracking effect triggered:', { 
      user: !!user, 
      room: !!room, 
      locationEnabled, 
      roomStatus: room?.status 
    });
    
    if (!user || !room || !locationEnabled) {
      console.log('Location tracking skipped - missing requirements');
      return;
    }
    if (room.status !== 'active' && room.status !== 'headstart') {
      console.log('Location tracking skipped - game not in active/headstart phase');
      return;
    }

    console.log('Starting optimized location tracking for user:', user.id);
    let isTracking = true;
    let isFirstUpdate = true;

    // Optimized location update function with immediate first update
    let locationUpdateTimeout: NodeJS.Timeout | null = null;
    const optimizedLocationUpdate = (location: any) => {
      if (!isTracking) return;

      // First update is immediate for instant visibility
      if (isFirstUpdate) {
        isFirstUpdate = false;
        updatePlayerLocation(params.roomCode, user.id, location);
        return;
      }

      // Subsequent updates are debounced for performance
      if (locationUpdateTimeout) {
        clearTimeout(locationUpdateTimeout);
      }
      locationUpdateTimeout = setTimeout(async () => {
        if (isTracking) {
          await updatePlayerLocation(params.roomCode, user.id, location);
        }
      }, 1000); // 1 second debounce for subsequent updates
    };

    locationService.startWatching(
      optimizedLocationUpdate,
      (error) => {
        if (isTracking) {
          console.error('Location tracking error:', error);
          setLocationError(`Location error: ${error}`);
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      console.log('Stopping optimized location tracking');
      isTracking = false;
      if (locationUpdateTimeout) {
        clearTimeout(locationUpdateTimeout);
      }
      locationService.stopWatching();
    };
  }, [user, room, locationEnabled, params.roomCode]);

  // Memoized time formatting function
  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Memoized player calculations for performance - moved before early returns
  const playerData = useMemo(() => {
    if (!room) return { players: [], aliveKillers: [], aliveSurvivors: [], deadPlayers: [] };
    const players = Object.values(room.players);
    return {
      players,
      aliveKillers: players.filter(p => p.role === 'killer' && p.isAlive),
      aliveSurvivors: players.filter(p => p.role === 'survivor' && p.isAlive),
      deadPlayers: players.filter(p => !p.isAlive)
    };
  }, [room]);

  const { players, aliveKillers, aliveSurvivors, deadPlayers } = playerData;

  // Memoized nearest survivor calculation for killers - moved before early returns
  const nearestSurvivor = useMemo(() => {
    if (currentPlayer?.role !== 'killer' || !currentPlayer?.location || !room) {
      return null;
    }
    
    return aliveSurvivors
      .filter(survivor => survivor.location)
      .reduce((closest, survivor) => {
        if (!closest) return survivor;
        
        const closestDistance = locationService.calculateDistance(
          currentPlayer.location!,
          closest.location!
        );
        const survivorDistance = locationService.calculateDistance(
          currentPlayer.location!,
          survivor.location!
        );
        
        return survivorDistance < closestDistance ? survivor : closest;
      }, null as Player | null);
  }, [currentPlayer?.role, currentPlayer?.location, aliveSurvivors, room]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-lg">Loading game...</div>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Game Error</h1>
          <p className="text-red-600 mb-4">{error || 'Game not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  const isHeadstart = room.status === 'headstart';
  const isActive = room.status === 'active';

  return (
    <main className="flex min-h-screen flex-col p-4 max-w-2xl mx-auto">
      <div className="w-full bg-white rounded-lg shadow-lg p-6 text-black mb-4">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">
            {isHeadstart ? 'HEADSTART' : 'GAME ACTIVE'}
          </h1>
          
          {isHeadstart && (
            <div className="mb-4">
              <div className="text-4xl font-mono font-bold text-orange-600">
                {formatTime(headstartRemaining)}
              </div>
              <p className="text-gray-600">Time to hide and prepare</p>
            </div>
          )}

          {isActive && (
            <div className="mb-4">
              <div className="text-4xl font-mono font-bold text-red-600">
                {formatTime(timeRemaining)}
              </div>
              <p className="text-gray-600">Time remaining</p>
            </div>
          )}

          <div className="flex justify-center gap-4 text-sm">
            <span className="font-medium">
              Your role: <span className={`${currentPlayer?.role === 'killer' ? 'text-red-600' : 'text-blue-600'}`}>
                {currentPlayer?.role?.toUpperCase()}
              </span>
            </span>
          </div>
        </div>

        {currentPlayer?.isAlive && currentPlayer?.role === 'survivor' && isActive && (
          <div className="mb-6 text-center">
            <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4 mb-4">
              <div className="text-red-800 font-semibold mb-2">⚠️ Survivor Actions</div>
              <button
                onClick={handleEliminate}
                disabled={eliminating}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-xl disabled:opacity-50 shadow-lg transform active:scale-95 transition-transform"
              >
                {eliminating ? 'Reporting Death...' : '💀 I Was Caught!'}
              </button>
              <p className="text-xs text-red-700 mt-2">
                Only press this if you were tagged by a killer
              </p>
            </div>
          </div>
        )}

        {currentPlayer?.isAlive && currentPlayer?.role === 'killer' && isActive && (
          <div className="mb-6 text-center">
            <div className="bg-red-600 text-white rounded-lg p-4">
              <div className="font-bold text-lg mb-2">🔪 You are a KILLER!</div>
              <p className="text-sm">
                Hunt down the survivors! They have {Math.max(0, Math.floor(timeRemaining / 60000))} minutes left to hide.
              </p>
            </div>
          </div>
        )}

        {/* Map Section - Available to all alive players during active game */}
        {currentPlayer?.isAlive && isActive && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-lg font-semibold ${
                currentPlayer?.role === 'killer' ? 'text-red-600' : 'text-blue-600'
              }`}>
                🗺️ {currentPlayer?.role === 'killer' ? 'Tracking Map' : 'Survivor Map'}
              </h2>
              <button
                onClick={() => setShowMap(!showMap)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  currentPlayer?.role === 'killer' 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {showMap ? 'Hide Map' : 'Show Map'}
              </button>
            </div>
            
            {showMap && (
              <InteractiveGameMap
                players={players}
                currentPlayerUid={user?.id || ''}
                isKiller={currentPlayer?.role === 'killer'}
                selectedPlayerId={selectedPlayerId}
                onPlayerClick={handlePlayerClick}
                onMapClick={() => setSelectedPlayerId(null)}
                className="mb-4"
              />
            )}
            
            {!showMap && (
              <div className={`border rounded-lg p-3 text-center ${
                currentPlayer?.role === 'killer' 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <p className={`text-sm ${
                  currentPlayer?.role === 'killer' ? 'text-red-700' : 'text-blue-700'
                }`}>
                  Click &quot;Show Map&quot; to see {currentPlayer?.role === 'killer' ? 'survivor locations' : 'your location and other survivors'}
                </p>
              </div>
            )}
          </div>
        )}

        {!currentPlayer?.isAlive && (
          <div className="mb-6">
            <div className="text-center mb-4">
              <div className="bg-gray-600 text-white rounded-lg p-4">
                <div className="font-bold text-lg mb-2">💀 You have been eliminated</div>
                <p className="text-sm">
                  Watch the remaining players battle it out!
                </p>
              </div>
            </div>
            
            {/* Spectator Map */}
            {isActive && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-600">👻 Spectator Map</h2>
                  <button
                    onClick={() => setShowMap(!showMap)}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                  >
                    {showMap ? 'Hide Map' : 'Show Map'}
                  </button>
                </div>
                
                {showMap && (
                  <InteractiveGameMap
                    players={players}
                    currentPlayerUid={user?.id || ''}
                    isKiller={false}
                    isEliminated={true} // Spectators can see everyone
                        selectedPlayerId={selectedPlayerId}
                    onPlayerClick={handlePlayerClick}
                    onMapClick={() => setSelectedPlayerId(null)}
                    className="mb-4"
                  />
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-3 text-red-600">
              Killers ({aliveKillers.length})
            </h2>
            <div className="space-y-2">
              {players.filter(p => p.role === 'killer').map((player) => {
                const canClick = currentPlayer?.role === 'killer' || !currentPlayer?.isAlive;
                return (
                  <PlayerCard 
                    key={player.uid} 
                    player={player} 
                    onClick={handlePlayerClick}
                    canClick={canClick}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3 text-blue-600">
              Survivors ({aliveSurvivors.length})
            </h2>
            <div className="space-y-2">
              {players.filter(p => p.role === 'survivor').map((player) => {
                const canClick = true; // Everyone can click on survivors
                return (
                  <PlayerCard 
                    key={player.uid} 
                    player={player} 
                    onClick={handlePlayerClick}
                    canClick={canClick}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {deadPlayers.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-600">
              Eliminated ({deadPlayers.length})
            </h2>
            <div className="space-y-2">
              {deadPlayers
                .sort((a, b) => (a.eliminatedAt || 0) - (b.eliminatedAt || 0))
                .map((player) => {
                  const canClick = !currentPlayer?.isAlive; // Only eliminated players can click on eliminated players
                  return (
                    <PlayerCard 
                      key={player.uid} 
                      player={player} 
                      onClick={handlePlayerClick}
                      canClick={canClick}
                    />
                  );
                })}
            </div>
          </div>
        )}
      </div>

      <div className="text-center">
        <button
          onClick={() => router.push(`/room/${params.roomCode}`)}
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Back to Room
        </button>
      </div>

      {/* Location Error Display */}
      {locationError && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">📍 {locationError}</p>
        </div>
      )}

      {/* Location Status */}
      {locationEnabled && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm">📍 Location sharing enabled</p>
        </div>
      )}


      <LocationPermissionModal
        isOpen={showLocationModal}
        onPermissionGranted={handleLocationPermissionGranted}
        onPermissionDenied={handleLocationPermissionDenied}
        onSkip={handleLocationSkip}
      />

      {/* Proximity Arrow for Killers */}
      {currentPlayer?.role === 'killer' && 
       currentPlayer?.isAlive && 
       isActive && 
       nearestSurvivor && 
       currentPlayer?.location && (
        <ProximityArrow
          currentPlayer={currentPlayer}
          nearestSurvivor={nearestSurvivor}
        />
      )}
    </main>
  );
}

const PlayerCard = memo(function PlayerCard({ player, onClick, canClick }: { 
  player: Player; 
  onClick?: (playerId: string) => void;
  canClick?: boolean;
}) {
  const handleClick = useCallback(() => {
    if (canClick && player.location && onClick) {
      onClick(player.uid);
    }
  }, [canClick, player.location, player.uid, onClick]);

  const cardStyles = useMemo(() => ({
    container: `flex items-center gap-3 p-3 rounded-lg ${
      player.isAlive ? 'bg-gray-50' : 'bg-gray-200 opacity-75'
    } ${canClick && player.location ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`,
    name: `font-medium ${!player.isAlive ? 'line-through text-gray-500' : ''}`
  }), [player.isAlive, canClick, player.location]);

  const eliminatedTime = useMemo(() => {
    if (!player.eliminatedAt) return null;
    return new Date(player.eliminatedAt).toLocaleTimeString();
  }, [player.eliminatedAt]);

  return (
    <div className={cardStyles.container} onClick={handleClick}>
      {player.profilePictureUrl ? (
        <img
          src={player.profilePictureUrl}
          alt={player.displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-sm font-medium text-gray-700">
            {player.displayName[0]?.toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1">
        <p className={cardStyles.name}>
          {player.displayName}
        </p>
        {!player.isAlive && eliminatedTime && (
          <p className="text-xs text-gray-500">
            Eliminated {eliminatedTime}
          </p>
        )}
      </div>
      {!player.isAlive && (
        <div className="text-red-500 text-sm font-medium">
          💀
        </div>
      )}
    </div>
  );
});

export default function GamePageWrapper({ params }: PageProps) {
  return (
    <AuthGuard fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <p>Please sign in to access this game.</p>
      </main>
    }>
      <GamePage params={params} />
    </AuthGuard>
  );
}