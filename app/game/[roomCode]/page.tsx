'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSoundNotifications } from '@/hooks/useSoundNotifications';
import { subscribeToRoom, eliminatePlayer, updatePlayerLocation, clearPlayerLocation } from '@/lib/gameService';
import { Room, Player } from '@/types/game';
import { locationService } from '@/lib/locationService';
import AuthGuard from '@/components/AuthGuard';
import LocationPermissionModal from '@/components/LocationPermissionModal';
import GameMap from '@/components/GameMap';

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
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [headstartRemaining, setHeadstartRemaining] = useState(0);
  const [eliminating, setEliminating] = useState(false);
  const [gameStartSoundPlayed, setGameStartSoundPlayed] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;

    const unsubscribe = subscribeToRoom(params.roomCode, (roomData) => {
      if (!roomData) {
        setError('Room not found');
        setLoading(false);
        return;
      }

      // Check if current user has been kicked from the room
      if (!roomData.players[user.id]) {
        console.log('User has been kicked from game:', user.id);
        setError('You have been removed from this room');
        setTimeout(() => router.push('/'), 2000);
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
        // Clear location when game ends
        handleGameEnd();
        router.push(`/results/${params.roomCode}`);
      }
    });

    return unsubscribe;
  }, [user, profile, params.roomCode, router, showLocationModal, locationEnabled]);

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
  }, [room]);

  const handleEliminate = async () => {
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
  };

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

  const handleGameEnd = async () => {
    if (!user) return;
    
    console.log('Game ending, clearing location tracking');
    locationService.stopWatching();
    await clearPlayerLocation(params.roomCode, user.id);
    setLocationEnabled(false);
  };

  // Location tracking effect
  useEffect(() => {
    if (!user || !room || !locationEnabled) return;
    if (room.status !== 'active' && room.status !== 'headstart') return;

    console.log('Starting location tracking for user:', user.id);

    // Start watching location changes
    locationService.startWatching(
      async (location) => {
        await updatePlayerLocation(params.roomCode, user.id, location);
      },
      (error) => {
        console.error('Location tracking error:', error);
        setLocationError(`Location error: ${error}`);
      }
    );

    // Cleanup when component unmounts or dependencies change
    return () => {
      console.log('Stopping location tracking');
      locationService.stopWatching();
    };
  }, [user, room, locationEnabled, params.roomCode]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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

  const currentPlayer = room.players[user?.id || ''];
  const players = Object.values(room.players);
  const aliveKillers = players.filter(p => p.role === 'killer' && p.isAlive);
  const aliveSurvivors = players.filter(p => p.role === 'survivor' && p.isAlive);
  const deadPlayers = players.filter(p => !p.isAlive);

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

        {/* Map Section for Killers */}
        {currentPlayer?.role === 'killer' && isActive && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-red-600">🗺️ Tracking Map</h2>
              <button
                onClick={() => setShowMap(!showMap)}
                className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
              >
                {showMap ? 'Hide Map' : 'Show Map'}
              </button>
            </div>
            
            {showMap && (
              <GameMap
                players={players}
                currentPlayerUid={user?.id || ''}
                isKiller={true}
                className="mb-4"
              />
            )}
            
            {!showMap && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <p className="text-red-700 text-sm">Click &quot;Show Map&quot; to track survivor locations</p>
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
                  <GameMap
                    players={players}
                    currentPlayerUid={user?.id || ''}
                    isKiller={true} // Show full map view for spectators
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
              {players.filter(p => p.role === 'killer').map((player) => (
                <PlayerCard key={player.uid} player={player} />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3 text-blue-600">
              Survivors ({aliveSurvivors.length})
            </h2>
            <div className="space-y-2">
              {players.filter(p => p.role === 'survivor').map((player) => (
                <PlayerCard key={player.uid} player={player} />
              ))}
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
                .map((player) => (
                  <PlayerCard key={player.uid} player={player} />
                ))}
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
    </main>
  );
}

function PlayerCard({ player }: { player: Player }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${
      player.isAlive ? 'bg-gray-50' : 'bg-gray-200 opacity-75'
    }`}>
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
        <p className={`font-medium ${!player.isAlive ? 'line-through text-gray-500' : ''}`}>
          {player.displayName}
        </p>
        {!player.isAlive && player.eliminatedAt && (
          <p className="text-xs text-gray-500">
            Eliminated {new Date(player.eliminatedAt).toLocaleTimeString()}
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
}

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