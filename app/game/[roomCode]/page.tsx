'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSoundNotifications } from '@/hooks/useSoundNotifications';
import { subscribeToRoom, eliminatePlayer, updatePlayerLocation, clearPlayerLocation, completeSkillcheck, markPlayerEscaped } from '@/lib/gameService';
import { Room, Player } from '@/types/game';
import { locationService, HIGH_FREQUENCY_LOCATION_OPTIONS } from '@/lib/locationService';
import AuthGuard from '@/components/AuthGuard';
import LocationPermissionModal from '@/components/LocationPermissionModal';
import InteractiveGameMap from '@/components/InteractiveGameMap';
import ProximityArrow from '@/components/ProximityArrow';
import SkillcheckMinigame from '@/components/SkillcheckMinigame';

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
  
  // Helper function to get escape area (handles PostgreSQL case sensitivity)
  const getEscapeArea = (room: Room) => room.escapearea || room.escapeArea;
  const getAllSkillchecksCompleted = (room: Room) => room.allskillcheckscompleted || room.allSkillchecksCompleted;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSuccessfulRoom, setLastSuccessfulRoom] = useState<Room | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [headstartRemaining, setHeadstartRemaining] = useState(0);
  const [escapeTimerRemaining, setEscapeTimerRemaining] = useState(0);
  const [eliminating, setEliminating] = useState(false);
  const [gameStartSoundPlayed, setGameStartSoundPlayed] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showPracticeSkillcheck, setShowPracticeSkillcheck] = useState(false);
  const [activeSkillcheck, setActiveSkillcheck] = useState<string | null>(null);
  const [nearbyEscapeArea, setNearbyEscapeArea] = useState(false);
  const [showSkillcheckPrompt, setShowSkillcheckPrompt] = useState<string | null>(null);
  const [showEscapePrompt, setShowEscapePrompt] = useState(false);

  // Handle practice skillcheck
  const handlePracticeSkillcheckSuccess = () => {
    console.log('Practice skillcheck succeeded!');
    setShowPracticeSkillcheck(false);
    // You could add a success sound/vibration here
    vibrate(200);
  };

  const handlePracticeSkillcheckFailure = () => {
    console.log('Practice skillcheck failed!');
    setShowPracticeSkillcheck(false);
    // You could add a failure sound/vibration here
    vibrate([100, 50, 100]);
  };

  // Handle real skillcheck completion
  const handleSkillcheckSuccess = async (skillcheckId: string) => {
    if (!user) return;
    console.log('Real skillcheck succeeded!', skillcheckId);
    setActiveSkillcheck(null);
    setShowSkillcheckPrompt(null);
    vibrate(200);
    
    try {
      await completeSkillcheck(params.roomCode, skillcheckId, user.id);
    } catch (error) {
      console.error('Error completing skillcheck:', error);
    }
  };

  const handleSkillcheckFailure = (skillcheckId: string) => {
    console.log('Real skillcheck failed!', skillcheckId);
    setActiveSkillcheck(null);
    setShowSkillcheckPrompt(null);
    vibrate([100, 50, 100]);
  };

  // Handle escape area interaction
  const handleEscape = useCallback(async () => {
    if (!user) return;
    console.log('🏃 Player attempting escape!');
    setShowEscapePrompt(false);
    setNearbyEscapeArea(false);
    
    try {
      console.log('🏃 Calling markPlayerEscaped for player:', user.id);
      await markPlayerEscaped(params.roomCode, user.id, false); // Normal gameplay, not debug
      console.log('✅ Escape processing completed');
      vibrate([200, 100, 200, 100, 200]);
    } catch (error) {
      console.error('❌ Error escaping:', error);
      // Show error to user
      alert('Failed to escape. Please try again.');
    }
  }, [user, params.roomCode, vibrate]);

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
    
    // Create a timeout to reset the button if the operation hangs
    const timeout = setTimeout(() => {
      console.warn('Elimination timeout - resetting button state');
      setEliminating(false);
    }, 10000); // 10 second timeout

    try {
      // Find a random alive killer to attribute the elimination to
      const aliveKillers = Object.values(room.players).filter(p => p.role === 'killer' && p.isAlive);
      const eliminatedBy = aliveKillers.length > 0 ? aliveKillers[Math.floor(Math.random() * aliveKillers.length)].uid : undefined;
      
      console.log('Eliminating player with eliminatedBy:', eliminatedBy);
      await eliminatePlayer(params.roomCode, user.id, eliminatedBy);
      
      playElimination();
      vibrate([300, 100, 300, 100, 300]);
      
      // Wait a brief moment for real-time update, then reset state
      setTimeout(() => {
        setEliminating(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error eliminating player:', error);
      setEliminating(false);
    } finally {
      clearTimeout(timeout);
    }
  }, [user, room, params.roomCode, playElimination, vibrate]);

  // Reset eliminating state when player is actually eliminated via real-time updates
  useEffect(() => {
    if (currentPlayer && !currentPlayer.isAlive && eliminating) {
      console.log('Player eliminated via real-time update - resetting button state');
      setEliminating(false);
    }
  }, [currentPlayer?.isAlive, eliminating]);

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

      // Check if escape area was just revealed - force map refresh
      if (roomData.escapeArea?.isRevealed && (!room?.escapeArea?.isRevealed)) {
        // Force component re-render by updating map key
        setShowMap(false);
        setTimeout(() => setShowMap(true), 100);
      }

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
  }, [user, profile, params.roomCode, router, showLocationModal, locationEnabled, lastSuccessfulRoom, handleGameEnd, room?.escapeArea?.isRevealed]);

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

      // Handle escape timer (10 minutes after escape area revealed)
      const escapeArea = getEscapeArea(room);
      if (room.status === 'active' && room.escape_timer_started_at && escapeArea?.isRevealed) {
        const escapeEnd = room.escape_timer_started_at + (10 * 60 * 1000); // 10 minutes
        const escapeRemaining = Math.max(0, escapeEnd - now);
        setEscapeTimerRemaining(escapeRemaining);

        // Play warning sounds in final 60 seconds
        if (escapeRemaining <= 60000 && escapeRemaining > 0 && Math.floor(escapeRemaining / 1000) !== Math.floor((escapeRemaining - 1000) / 1000)) {
          const secondsLeft = Math.floor(escapeRemaining / 1000);
          if (secondsLeft <= 10) {
            playCountdown();
            vibrate([200, 100, 200]); // More intense vibration for escape timer
          } else if (secondsLeft % 10 === 0) {
            playGameStart(); // Warning sound every 10 seconds in final minute
            vibrate(150);
          }
        }

        // Auto-eliminate when escape timer expires
        if (escapeRemaining <= 0 && room.escape_timer_started_at && (now - room.escape_timer_started_at) > (10 * 60 * 1000)) {
          console.log('Escape timer expired on client side, triggering auto-elimination');
          import('@/lib/gameService').then(({ checkEscapeTimerExpired }) => {
            checkEscapeTimerExpired(params.roomCode);
          });
        }
      } else {
        setEscapeTimerRemaining(0);
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

  // Proximity checking function
  const checkProximity = useCallback((playerLocation: any) => {
    if (!room || !currentPlayer?.isAlive || currentPlayer.role !== 'survivor') return;

    const PROXIMITY_DISTANCE = 50; // 50 meters

    // Check skillcheck proximity
    if (room.skillchecks && room.settings.skillchecks?.enabled) {
      const incompleteSkillchecks = room.skillchecks.filter(sc => !sc.isCompleted);
      
      for (const skillcheck of incompleteSkillchecks) {
        const distance = locationService.calculateDistance(
          playerLocation,
          skillcheck.location
        );
        
        if (distance <= PROXIMITY_DISTANCE) {
          // Player is near an incomplete skillcheck
          if (!showSkillcheckPrompt && !activeSkillcheck) {
            console.log('Near skillcheck:', skillcheck.id, 'distance:', distance);
            setShowSkillcheckPrompt(skillcheck.id);
            vibrate(100);
          }
          return; // Only show one prompt at a time
        }
      }
    }

    // Check escape area proximity
    const escapeArea = getEscapeArea(room);
    if (escapeArea?.isRevealed && !currentPlayer.hasEscaped) {
      const distance = locationService.calculateDistance(
        playerLocation,
        escapeArea.location
      );
      
      if (distance <= PROXIMITY_DISTANCE) {
        // Player is near escape area
        if (!showEscapePrompt && !nearbyEscapeArea) {
          console.log('Near escape area, distance:', distance);
          setNearbyEscapeArea(true);
          setShowEscapePrompt(true);
          vibrate([100, 50, 100]);
        }
      } else {
        // Player moved away from escape area
        if (nearbyEscapeArea) {
          setNearbyEscapeArea(false);
          setShowEscapePrompt(false);
        }
      }
    }

    // Clear skillcheck prompt if player moved away
    if (showSkillcheckPrompt && room.skillchecks) {
      const skillcheck = room.skillchecks.find(sc => sc.id === showSkillcheckPrompt);
      if (skillcheck) {
        const distance = locationService.calculateDistance(
          playerLocation,
          skillcheck.location
        );
        if (distance > PROXIMITY_DISTANCE) {
          setShowSkillcheckPrompt(null);
        }
      }
    }
  }, [room, currentPlayer, showSkillcheckPrompt, activeSkillcheck, showEscapePrompt, nearbyEscapeArea, vibrate]);

  // Location tracking effect
  useEffect(() => {
    if (!user || !room || !locationEnabled) return;
    if (room.status !== 'active' && room.status !== 'headstart') return;

    console.log('Starting location tracking for user:', user.id);

    // Start watching location changes with high frequency for active games
    locationService.startWatching(
      async (location) => {
        await updatePlayerLocation(params.roomCode, user.id, location);
        
        // Check proximity to skillchecks and escape area (survivors only)
        if (currentPlayer?.role === 'survivor' && currentPlayer?.isAlive) {
          checkProximity(location);
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
        setLocationError(`Location error: ${error}`);
      },
      HIGH_FREQUENCY_LOCATION_OPTIONS
    );

    // Cleanup when component unmounts or dependencies change
    return () => {
      console.log('Stopping location tracking');
      locationService.stopWatching();
    };
  }, [user, room, locationEnabled, params.roomCode, currentPlayer?.isAlive, currentPlayer?.role, checkProximity]);

  // Memoized time formatting function
  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Memoized player calculations for performance - moved before early returns
  const playerData = useMemo(() => {
    if (!room) return { players: [], aliveKillers: [], aliveSurvivors: [], deadPlayers: [], escapedPlayers: [] };
    const players = Object.values(room.players);
    return {
      players,
      aliveKillers: players.filter(p => p.role === 'killer' && p.isAlive),
      aliveSurvivors: players.filter(p => p.role === 'survivor' && p.isAlive && !p.hasEscaped),
      deadPlayers: players.filter(p => !p.isAlive && !p.hasEscaped), // Only eliminated players, not escaped
      escapedPlayers: players.filter(p => p.hasEscaped) // All escaped players (killers or survivors)
    };
  }, [room]);

  const { players, aliveKillers, aliveSurvivors, deadPlayers, escapedPlayers } = playerData;

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

          {/* Escape Timer - only show when escape area is revealed */}
          {isActive && room?.escapeArea?.isRevealed && room?.settings.skillchecks?.enabled && escapeTimerRemaining > 0 && (
            <div className="mb-4 border-2 border-purple-300 bg-purple-50 rounded-lg p-4">
              <div className="text-3xl font-mono font-bold text-purple-700">
                ⏰ {formatTime(escapeTimerRemaining)}
              </div>
              <p className="text-purple-600 font-medium">ESCAPE TIMER - Reach the escape area!</p>
              <p className="text-xs text-purple-500 mt-1">Auto-elimination if time expires</p>
            </div>
          )}

          <div className="flex justify-center gap-4 text-sm">
            <span className="font-medium">
              Your role: <span className={`${currentPlayer?.role === 'killer' ? 'text-red-600' : 'text-blue-600'}`}>
                {currentPlayer?.role?.toUpperCase()}
              </span>
            </span>
          </div>

          {/* Game Status Indicators */}
          {room.settings.skillchecks?.enabled && currentPlayer?.role === 'survivor' && isActive && (
            <div className="mt-4 space-y-2">
              {/* Skillcheck Progress */}
              {room.skillchecks && room.skillchecks.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-800">⚡ Skillcheck Progress</span>
                    <span className="text-xs text-blue-600">
                      {room.skillchecks.filter(sc => sc.isCompleted).length} / {room.skillchecks.length}
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(room.skillchecks.filter(sc => sc.isCompleted).length / room.skillchecks.length) * 100}%` 
                      }}
                    />
                  </div>
                  {(room.allskillcheckscompleted || room.allSkillchecksCompleted) && (
                    <div className="text-xs text-green-600 mt-1 font-medium">
                      ✓ All skillchecks completed! Escape area revealed.
                    </div>
                  )}
                </div>
              )}

              {/* Escape Area Status */}
              {room.escapeArea?.isRevealed && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-purple-800">🚪 Escape Area Active</span>
                    {room.escapeArea.escapedPlayers.length > 0 && (
                      <span className="text-xs text-purple-600">
                        {room.escapeArea.escapedPlayers.length} escaped
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-purple-600 mt-1">
                    Find the purple door on the map to escape! 
                    {escapeTimerRemaining > 0 && ` ${Math.ceil(escapeTimerRemaining / 60000)} min left!`}
                  </div>
                </div>
              )}

              {/* Player Escaped Status */}
              {currentPlayer.hasEscaped && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-800">🎉 You Escaped!</div>
                  <div className="text-xs text-green-600 mt-1">
                    Congratulations! You&apos;ve won the game for all survivors.
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Game should end automatically...
                  </div>
                </div>
              )}

              {/* Manual Escape Button for Testing */}
              {user?.id === room.host_uid && nearbyEscapeArea && !currentPlayer.hasEscaped && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <button
                    onClick={handleEscape}
                    className="w-full bg-purple-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-purple-600"
                  >
                    🏃 Manual Escape (Testing)
                  </button>
                  <div className="text-xs text-purple-600 mt-1">
                    Host testing escape functionality
                  </div>
                </div>
              )}
            </div>
          )}
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
            
            {/* Practice Skillcheck Button (only if skillchecks are enabled) */}
            {room?.settings.skillchecks?.enabled && (
              <div className="bg-amber-100 border-2 border-amber-300 rounded-lg p-4">
                <div className="text-amber-800 font-semibold mb-2">⚡ Skillcheck Practice</div>
                <button
                  onClick={() => setShowPracticeSkillcheck(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 shadow-lg transform active:scale-95 transition-transform"
                >
                  🎯 Practice Skillcheck
                </button>
                <p className="text-xs text-amber-700 mt-2">
                  Practice the timing challenge before attempting real skillchecks
                </p>
              </div>
            )}
          </div>
        )}

        {currentPlayer?.isAlive && currentPlayer?.role === 'killer' && isActive && (
          <div className="mb-6 text-center">
            <div className="bg-red-600 text-white rounded-lg p-4">
              <div className="font-bold text-lg mb-2">🔪 You are a KILLER!</div>
              <p className="text-sm">
                Hunt down the survivors! They have {Math.max(0, Math.floor(timeRemaining / 60000))} minutes left to hide.
              </p>
              
              {/* Killer notifications for skillcheck progress */}
              {room?.settings.skillchecks?.enabled && room?.skillchecks && (
                <div className="mt-3 pt-3 border-t border-red-400">
                  <div className="text-xs font-medium">⚡ Skillcheck Progress</div>
                  <div className="text-xs opacity-90 mt-1">
                    {room.skillchecks.filter(sc => sc.isCompleted).length} / {room.skillchecks.length} completed by survivors
                  </div>
                  {(room.allskillcheckscompleted || room.allSkillchecksCompleted) && (
                    <div className="text-xs bg-red-500 px-2 py-1 rounded mt-2">
                      🚨 ALL SKILLCHECKS COMPLETE - Escape area is now active!
                    </div>
                  )}
                  {room.escapeArea?.isRevealed && !(room.allskillcheckscompleted || room.allSkillchecksCompleted) && (
                    <div className="text-xs bg-red-500 px-2 py-1 rounded mt-2">
                      🚨 Timer expired - Escape area is now active!
                    </div>
                  )}
                </div>
              )}
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
                skillchecks={room?.skillchecks}
                escapeArea={getEscapeArea(room)}
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
                    skillchecks={room?.skillchecks}
                    escapeArea={room?.escapeArea}
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

        {/* Escaped Players Section */}
        {escapedPlayers.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3 text-green-600">
              Escaped ({escapedPlayers.length})
            </h2>
            <div className="space-y-2">
              {escapedPlayers
                .sort((a, b) => (a.escapedAt || 0) - (b.escapedAt || 0))
                .map((player) => {
                  const canClick = !currentPlayer?.isAlive || currentPlayer.hasEscaped; // Escaped/eliminated players can click
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
      
      {/* Practice Skillcheck Minigame */}
      <SkillcheckMinigame
        isOpen={showPracticeSkillcheck}
        onSuccess={handlePracticeSkillcheckSuccess}
        onFailure={handlePracticeSkillcheckFailure}
        onClose={() => setShowPracticeSkillcheck(false)}
        skillcheckId="practice"
      />

      {/* Real Skillcheck Minigame */}
      {activeSkillcheck && (
        <SkillcheckMinigame
          isOpen={true}
          onSuccess={() => handleSkillcheckSuccess(activeSkillcheck)}
          onFailure={() => handleSkillcheckFailure(activeSkillcheck)}
          onClose={() => {
            setActiveSkillcheck(null);
            setShowSkillcheckPrompt(null);
          }}
          skillcheckId={activeSkillcheck}
        />
      )}

      {/* Skillcheck Proximity Prompt */}
      {showSkillcheckPrompt && !activeSkillcheck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 text-black max-w-sm mx-4 text-center">
            <div className="text-2xl mb-4">⚡ Skillcheck Detected!</div>
            <p className="mb-6">You&apos;re near a skillcheck. Complete it to help your team progress!</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setActiveSkillcheck(showSkillcheckPrompt);
                  setShowSkillcheckPrompt(null);
                }}
                className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg font-bold hover:bg-blue-600"
              >
                Start Skillcheck
              </button>
              <button
                onClick={() => setShowSkillcheckPrompt(null)}
                className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-bold hover:bg-gray-400"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escape Area Proximity Prompt */}
      {showEscapePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 text-black max-w-sm mx-4 text-center">
            <div className="text-2xl mb-4">🚪 Escape Area Found!</div>
            <p className="mb-6">You&apos;ve reached the escape zone! Escape now to save yourself! {escapeTimerRemaining > 0 && `Time left: ${Math.ceil(escapeTimerRemaining / 1000)}s`}</p>
            <div className="flex gap-3">
              <button
                onClick={handleEscape}
                className="flex-1 bg-purple-500 text-white py-3 px-4 rounded-lg font-bold hover:bg-purple-600"
              >
                🏃 ESCAPE NOW!
              </button>
              <button
                onClick={() => setShowEscapePrompt(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-bold hover:bg-gray-400"
              >
                Not Yet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel - Only for Host During Testing */}
      {room && user?.id === room.host_uid && room.settings.skillchecks?.enabled && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 max-w-xs z-50">
          <div className="text-sm font-bold text-yellow-800 mb-2">🛠️ Host Debug Panel</div>
          
          {/* Visual Status Indicators */}
          <div className="text-xs mb-3 p-2 bg-white rounded border text-black">
            <div>Skillchecks: {room.skillchecks?.filter(sc => sc.isCompleted).length || 0}/{room.skillchecks?.length || 0}</div>
            <div>All Complete: {(room.allskillcheckscompleted || room.allSkillchecksCompleted) ? '✅' : '❌'}</div>
            <div>Escape Area Exists: {(room.escapearea || room.escapeArea) ? '✅' : '❌'}</div>
            <div>Escape Area Revealed: {(room.escapearea?.isRevealed || room.escapeArea?.isRevealed) ? '✅' : '❌'}</div>
            <div>Escape Timer: {room.escape_timer_started_at ? '✅' : '❌'}</div>
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="font-bold">Game State Debug:</div>
              <div>Room Status: {room.status}</div>
              <div>Alive Survivors: {aliveSurvivors.length}</div>
              <div>Escaped Survivors: {escapedPlayers.filter(p => p.role === 'survivor').length}</div>
              <div>Eliminated Survivors: {players.filter(p => p.role === 'survivor' && !p.isAlive && !p.hasEscaped).length}</div>
              <div>Current Player Escaped: {currentPlayer?.hasEscaped ? 'Yes' : 'No'}</div>
              <div>Current Player Alive: {currentPlayer?.isAlive ? 'Yes' : 'No'}</div>
            </div>
            {(room.escapearea || room.escapeArea) && (
              <div className="mt-2 pt-2 border-t border-gray-200 text-black">
                {(() => {
                  const escapeArea = room.escapearea || room.escapeArea;
                  if (!escapeArea) return null;
                  return (
                    <>
                      <div>Escape Area ID: {escapeArea.id}</div>
                      <div>Escape Area Coords: {escapeArea.location?.latitude?.toFixed(6)}, {escapeArea.location?.longitude?.toFixed(6)}</div>
                      <div>Revealed At: {escapeArea.revealedAt ? new Date(escapeArea.revealedAt).toLocaleTimeString() : 'Not set'}</div>
                      <div>Escaped Players: {escapeArea.escapedPlayers?.length || 0}</div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          
          {/* Skillcheck Testing */}
          {room.skillchecks && room.skillchecks.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-yellow-700 mb-1">Complete Skillchecks:</div>
              <div className="flex flex-wrap gap-1">
                {room.skillchecks.map((skillcheck, index) => (
                  <button
                    key={skillcheck.id}
                    onClick={async () => {
                      if (!skillcheck.isCompleted) {
                        console.log('🛠️ DEBUG: Completing skillcheck', skillcheck.id);
                        const { completeSkillcheck } = await import('@/lib/gameService');
                        await completeSkillcheck(room.id, skillcheck.id, user.id, true); // Debug mode = true
                        console.log('🛠️ DEBUG: Skillcheck completion request sent');
                      }
                    }}
                    disabled={skillcheck.isCompleted}
                    className={`px-2 py-1 text-xs rounded ${
                      skillcheck.isCompleted 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                    }`}
                  >
                    SC{index + 1} {skillcheck.isCompleted && '✓'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual Escape Area Reveal */}
          {!(room.escapearea || room.escapeArea) && (isActive || room.status === 'active') && (
            <button
              onClick={async () => {
                console.log('🛠️ DEBUG: Force revealing escape area');
                const { revealEscapeAreaOnTimer } = await import('@/lib/gameService');
                await revealEscapeAreaOnTimer(room.id);
                console.log('🛠️ DEBUG: Escape area reveal request sent');
              }}
              className="w-full mb-2 px-3 py-2 bg-purple-200 text-purple-800 text-xs rounded hover:bg-purple-300"
            >
              🚪 Force Reveal Escape Area
            </button>
          )}
          
          {/* Map Debug Info */}
          <div className="text-xs bg-gray-100 p-2 rounded mb-2 text-black">
            <div className="font-bold mb-1">Map Debug:</div>
            <div>escapeArea prop: {room.escapeArea ? 'Present' : 'Missing'}</div>
            <div>Map visibility: {showMap ? 'Visible' : 'Hidden'}</div>
            <div>Current role: {currentPlayer?.role || 'unknown'}</div>
            <div>Is eliminated: {currentPlayer?.isAlive === false ? 'Yes' : 'No'}</div>
            {room.escapeArea && currentPlayer?.role === 'survivor' && (
              <div className="mt-1 pt-1 border-t border-gray-300">
                <div>Should see escape area: {room.escapeArea.isRevealed && (currentPlayer?.role === 'survivor' || !currentPlayer?.isAlive) ? 'YES' : 'NO'}</div>
              </div>
            )}
          </div>

          {/* Manual Escape (for testing win conditions) */}
          {(room.escapearea?.isRevealed || room.escapeArea?.isRevealed) && (
            <button
              onClick={async () => {
                console.log('🛠️ DEBUG: Force escaping player');
                const { markPlayerEscaped } = await import('@/lib/gameService');
                await markPlayerEscaped(room.id, user.id, true); // Debug mode = true
                console.log('🛠️ DEBUG: Force escape request sent');
              }}
              className="w-full mb-2 px-3 py-2 bg-purple-300 text-purple-800 text-xs rounded hover:bg-purple-400"
            >
              🏃 Force Escape (Host)
            </button>
          )}

          {/* Manual Game End Check */}
          <button
            onClick={async () => {
              console.log('🛠️ DEBUG: Manually checking game end');
              const { checkGameEnd } = await import('@/lib/gameService');
              await checkGameEnd(room.id);
              console.log('🛠️ DEBUG: Game end check completed');
            }}
            className="w-full mb-2 px-3 py-2 bg-red-300 text-red-800 text-xs rounded hover:bg-red-400"
          >
            🏁 Force Check Game End
          </button>

          {/* Force Timer Expiration */}
          {room.escape_timer_started_at && (
            <button
              onClick={async () => {
                const { checkEscapeTimerExpired } = await import('@/lib/gameService');
                await checkEscapeTimerExpired(room.id);
              }}
              className="w-full mb-2 px-3 py-2 bg-red-200 text-red-800 text-xs rounded hover:bg-red-300"
            >
              ⏰ Force Timer Expiration
            </button>
          )}

          {/* Force Game End Check */}
          <button
            onClick={async () => {
              const { checkGameEnd } = await import('@/lib/gameService');
              await checkGameEnd(room.id);
            }}
            className="w-full px-3 py-2 bg-gray-200 text-gray-800 text-xs rounded hover:bg-gray-300"
          >
            🎯 Force Check Game End
          </button>
        </div>
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

  const cardStyles = useMemo(() => {
    const isInactive = !player.isAlive || player.hasEscaped;
    return {
      container: `flex items-center gap-3 p-3 rounded-lg ${
        isInactive ? 'bg-gray-200 opacity-75' : 'bg-gray-50'
      } ${canClick && player.location ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`,
      name: `font-medium ${isInactive ? 'line-through text-gray-500' : ''}`
    };
  }, [player.isAlive, player.hasEscaped, canClick, player.location]);

  const statusTime = useMemo(() => {
    if (player.hasEscaped && player.escapedAt) {
      return { type: 'escaped', time: new Date(player.escapedAt).toLocaleTimeString() };
    }
    if (!player.isAlive && player.eliminatedAt) {
      return { type: 'eliminated', time: new Date(player.eliminatedAt).toLocaleTimeString() };
    }
    return null;
  }, [player.eliminatedAt, player.escapedAt, player.hasEscaped, player.isAlive]);

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
        {statusTime && (
          <p className="text-xs text-gray-500">
            {statusTime.type === 'escaped' ? 'Escaped' : 'Eliminated'} {statusTime.time}
          </p>
        )}
      </div>
      {player.hasEscaped ? (
        <div className="text-green-500 text-sm font-medium">
          🎉
        </div>
      ) : !player.isAlive ? (
        <div className="text-red-500 text-sm font-medium">
          💀
        </div>
      ) : null}
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