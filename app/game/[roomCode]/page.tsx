/**
 * Game Page - Active Gameplay Interface
 * 
 * This is the main gameplay component for Granny IRL. Handles:
 * - Real-time game state updates via Supabase subscriptions
 * - GPS location tracking with 5-second updates
 * - Proximity detection for skillchecks (50m radius)
 * - Non-invasive notification system (modal → background)
 * - Dead by Daylight-style skillcheck minigames
 * - Escape area mechanics with purple door visualization
 * - Robust error handling with timeout protection
 * 
 * Game Flow:
 * 1. Players join room and enable location permissions
 * 2. Host starts game → headstart phase (survivors hide)
 * 3. Active phase begins → killers hunt survivors
 * 4. Skillchecks appear if enabled (proximity detection)
 * 5. Escape area reveals after timer/skillchecks complete
 * 6. Game ends when all survivors are eliminated/escaped
 * 
 * Key Features:
 * - Local state tracking prevents double prompts
 * - Background notifications don't block gameplay
 * - Timeout protection prevents stuck UI states
 * - Mobile-optimized with touch-friendly controls
 */
'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useSoundNotifications } from '@/hooks/useSoundNotifications';
import { subscribeToRoom, eliminatePlayer, updatePlayerLocation, clearPlayerLocation, completeSkillcheck, markPlayerEscaped } from '@/lib/gameService';
import { Room, Player } from '@/types/game';
import { locationService, HIGH_FREQUENCY_LOCATION_OPTIONS } from '@/lib/locationService';
import { clearRoomCache } from '@/lib/cacheUtils';
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
  
  // Helper functions to handle PostgreSQL case sensitivity
  // PostgreSQL converts column names to lowercase, so we check both variants
  const getEscapeArea = (room: Room) => room.escapearea || room.escapeArea;
  const getAllSkillchecksCompleted = (room: Room) => room.allskillcheckscompleted || room.allSkillchecksCompleted;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSuccessfulRoom, setLastSuccessfulRoom] = useState<Room | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [headstartRemaining, setHeadstartRemaining] = useState(0);
  const [escapeTimerRemaining, setEscapeTimerRemaining] = useState(0);
  // Core game state
  const [eliminating, setEliminating] = useState(false); // Prevents multiple "I was caught" clicks
  const [gameStartSoundPlayed, setGameStartSoundPlayed] = useState(false);
  
  // Location tracking state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationError, setLocationError] = useState('');
  
  // UI state
  const [showMap, setShowMap] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showPracticeSkillcheck, setShowPracticeSkillcheck] = useState(false);
  const [activeSkillcheck, setActiveSkillcheck] = useState<string | null>(null);
  const [nearbyEscapeArea, setNearbyEscapeArea] = useState(false);
  
  // Notification system state (prevents invasive prompts)
  const [showSkillcheckPrompt, setShowSkillcheckPrompt] = useState<string | null>(null); // Modal prompt
  const [showEscapePrompt, setShowEscapePrompt] = useState(false); // Modal prompt
  const [dismissedSkillcheckPrompts, setDismissedSkillcheckPrompts] = useState<Set<string>>(new Set()); // Dismissed modals
  const [dismissedEscapePrompt, setDismissedEscapePrompt] = useState(false); // Dismissed escape modal
  const [backgroundSkillcheck, setBackgroundSkillcheck] = useState<string | null>(null); // Background notification
  const [backgroundEscape, setBackgroundEscape] = useState(false); // Background notification
  
  // Local state for immediate UI updates (prevents race conditions)
  const [localCompletedSkillchecks, setLocalCompletedSkillchecks] = useState<Set<string>>(new Set());
  const [escaping, setEscaping] = useState(false); // Prevents multiple escape clicks
  const [showSkillcheckSuccess, setShowSkillcheckSuccess] = useState(false); // Success prompt

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
    
    // Show success prompt immediately
    setShowSkillcheckSuccess(true);
    
    // Auto-hide success prompt after 2 seconds
    setTimeout(() => {
      setShowSkillcheckSuccess(false);
    }, 2000);
    
    // Immediately add to local completed set to prevent double prompts
    setLocalCompletedSkillchecks(prev => {
      const newSet = new Set(prev);
      newSet.add(skillcheckId);
      return newSet;
    });
    
    // Clear background notification if it was for this skillcheck
    if (backgroundSkillcheck === skillcheckId) {
      setBackgroundSkillcheck(null);
    }
    
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

  // Get current player for boundary checking
  const currentPlayer = room ? room.players[user?.id || ''] : null;

  // Handle escape area interaction
  const handleEscape = useCallback(async () => {
    if (!user || escaping) return; // Prevent if already escaping
    
    console.log('🏃 Player attempting escape!');
    setEscaping(true);
    setShowEscapePrompt(false);
    setNearbyEscapeArea(false);
    setBackgroundEscape(false);
    
    try {
      console.log('🏃 Calling markPlayerEscaped for player:', user.id);
      
      // Add timeout protection to prevent multiple rapid clicks
      const escapePromise = markPlayerEscaped(params.roomCode, user.id, false);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Escape timeout')), 15000)
      );
      
      await Promise.race([escapePromise, timeoutPromise]);
      
      console.log('✅ Escape processing completed');
      vibrate([200, 100, 200, 100, 200]);
      
      // Force check game end immediately after escape
      setTimeout(async () => {
        console.log('Force checking game end after escape');
        const { checkGameEnd } = await import('@/lib/gameService');
        await checkGameEnd(params.roomCode);
      }, 500);
      
      // Keep button disabled until we see the escape in the room data
      
    } catch (error) {
      console.error('❌ Error escaping:', error);
      
      // Reset states on error so user can try again
      setEscaping(false);
      
      if (error instanceof Error && error.message === 'Escape timeout') {
        alert('Escape is taking longer than expected. Please wait or try again.');
      } else {
        alert('Failed to escape. Please try again.');
      }
    }
  }, [user, params.roomCode, vibrate, escaping]);

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

  const handleEliminate = useCallback(async () => {
    if (!user || !room || eliminating) return; // Prevent double clicks

    setEliminating(true);
    
    // Create a timeout to reset the button if the operation hangs
    const timeout = setTimeout(() => {
      console.warn('Elimination timeout - resetting button state');
      setEliminating(false);
    }, 15000); // 15 second timeout

    try {
      // Find a random alive killer to attribute the elimination to
      const aliveKillers = Object.values(room.players).filter(p => p.role === 'killer' && p.isAlive);
      const eliminatedBy = aliveKillers.length > 0 ? aliveKillers[Math.floor(Math.random() * aliveKillers.length)].uid : undefined;
      
      console.log('Eliminating player with eliminatedBy:', eliminatedBy);
      await eliminatePlayer(params.roomCode, user.id, eliminatedBy);
      
      playElimination();
      vibrate([300, 100, 300, 100, 300]);
      
      // Force check game end immediately after elimination
      setTimeout(async () => {
        console.log('Force checking game end after elimination');
        const { checkGameEnd } = await import('@/lib/gameService');
        await checkGameEnd(params.roomCode);
      }, 500);
      
      // Keep button disabled until we see the elimination in the room data
      // This prevents multiple clicks
      
    } catch (error) {
      console.error('Error eliminating player:', error);
      setEliminating(false);
    } finally {
      clearTimeout(timeout);
    }
  }, [user, room, params.roomCode, playElimination, vibrate, eliminating]);

  // Reset eliminating state when player is actually eliminated via real-time updates
  useEffect(() => {
    if (currentPlayer && !currentPlayer.isAlive && eliminating) {
      console.log('Player eliminated via real-time update - resetting button state');
      setEliminating(false);
    }
  }, [currentPlayer?.isAlive, eliminating]);

  // Reset escaping state when player successfully escapes via real-time updates
  useEffect(() => {
    if (currentPlayer?.hasEscaped && escaping) {
      console.log('Player escaped via real-time update - resetting button state');
      setEscaping(false);
    }
  }, [currentPlayer?.hasEscaped, escaping]);

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

    // Clear cache for this room to ensure fresh data
    clearRoomCache(params.roomCode);

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

    // Add automatic game end checking every second during active phase
    let gameCheckInterval: NodeJS.Timeout | null = null;
    if (room.status === 'active') {
      gameCheckInterval = setInterval(async () => {
        console.log('Auto-checking game end status');
        const { checkGameEnd } = await import('@/lib/gameService');
        await checkGameEnd(params.roomCode);
      }, 1000); // Check every second
    }

    return () => {
      clearInterval(interval);
      if (gameCheckInterval) clearInterval(gameCheckInterval);
    };
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
      // Filter out skillchecks that are completed OR locally tracked as completed
      const incompleteSkillchecks = room.skillchecks.filter(sc => 
        !sc.isCompleted && !localCompletedSkillchecks.has(sc.id)
      );
      
      for (const skillcheck of incompleteSkillchecks) {
        const distance = locationService.calculateDistance(
          playerLocation,
          skillcheck.location
        );
        
        if (distance <= PROXIMITY_DISTANCE) {
          // Player is near an incomplete skillcheck
          if (!showSkillcheckPrompt && !activeSkillcheck && !backgroundSkillcheck) {
            console.log('Near skillcheck:', skillcheck.id, 'distance:', distance);
            
            // If we've dismissed this prompt before, show it in background
            if (dismissedSkillcheckPrompts.has(skillcheck.id)) {
              setBackgroundSkillcheck(skillcheck.id);
            } else {
              // First time, show modal
              setShowSkillcheckPrompt(skillcheck.id);
              vibrate(100);
            }
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
        if (!showEscapePrompt && !nearbyEscapeArea && !backgroundEscape) {
          console.log('Near escape area, distance:', distance);
          setNearbyEscapeArea(true);
          
          // If we've dismissed the escape prompt before, show it in background
          if (dismissedEscapePrompt) {
            setBackgroundEscape(true);
          } else {
            // First time, show modal
            setShowEscapePrompt(true);
            vibrate([100, 50, 100]);
          }
        }
      } else {
        // Player moved away from escape area
        if (nearbyEscapeArea) {
          setNearbyEscapeArea(false);
          setShowEscapePrompt(false);
          setBackgroundEscape(false);
        }
      }
    }

    // Clear skillcheck prompt if player moved away
    if ((showSkillcheckPrompt || backgroundSkillcheck) && room.skillchecks) {
      const skillcheckId = showSkillcheckPrompt || backgroundSkillcheck;
      const skillcheck = room.skillchecks.find(sc => sc.id === skillcheckId);
      if (skillcheck) {
        const distance = locationService.calculateDistance(
          playerLocation,
          skillcheck.location
        );
        if (distance > PROXIMITY_DISTANCE) {
          setShowSkillcheckPrompt(null);
          setBackgroundSkillcheck(null);
        }
      }
    }
  }, [room, currentPlayer, showSkillcheckPrompt, activeSkillcheck, showEscapePrompt, nearbyEscapeArea, localCompletedSkillchecks, dismissedSkillcheckPrompts, dismissedEscapePrompt, backgroundSkillcheck, backgroundEscape, vibrate]);

  // Clear local completed skillchecks when game resets or room changes
  useEffect(() => {
    if (room?.status === 'waiting') {
      setLocalCompletedSkillchecks(new Set());
      setEscaping(false);
      setDismissedSkillcheckPrompts(new Set());
      setDismissedEscapePrompt(false);
      setBackgroundSkillcheck(null);
      setBackgroundEscape(false);
    }
  }, [room?.status]);

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
        <div className="glass-card p-8 text-center animate-slide-up">
          <div className="text-xl text-granny-text mb-4 flex items-center justify-center gap-2">
            🎮 Loading game...
          </div>
          <div className="w-8 h-8 border-2 border-granny-danger border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-granny-bg/80 to-granny-bg pointer-events-none" />
        <div className="glass-card p-8 text-center animate-slide-up relative z-10">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-granny-text mb-4">Game Error</h1>
          <p className="text-granny-error mb-6">{error || 'Game not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary px-6 py-3"
          >
            🏠 Back to Home
          </button>
        </div>
      </main>
    );
  }

  const isHeadstart = room.status === 'headstart';
  const isActive = room.status === 'active';

  return (
    <main className="flex min-h-screen flex-col p-4 max-w-4xl mx-auto relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-granny-bg/80 to-granny-bg pointer-events-none" />
      
      <div className="w-full glass-modal p-6 text-granny-text mb-4 relative z-10">
        <div className="text-center mb-6">
          <h1 className={`text-4xl font-bold mb-3 animate-glow flex items-center justify-center gap-3 ${
            isHeadstart ? 'text-granny-warning' : 'text-granny-danger'
          }`}>
            {isHeadstart ? '⚡ HEADSTART' : '🔥 GAME ACTIVE'}
          </h1>
          
          {isHeadstart && (
            <div className="mb-6">
              <div className="text-5xl font-mono font-bold text-granny-warning animate-pulse">
                {formatTime(headstartRemaining)}
              </div>
              <p className="text-granny-text-muted flex items-center justify-center gap-2">
                🏃 Time to hide and prepare
              </p>
            </div>
          )}

          {isActive && (
            <div className="mb-6">
              <div className="text-5xl font-mono font-bold text-granny-danger animate-pulse">
                {formatTime(timeRemaining)}
              </div>
              <p className="text-granny-text-muted flex items-center justify-center gap-2">
                ⏰ Time remaining
              </p>
            </div>
          )}

          {/* Escape Timer - only show when escape area is revealed */}
          {isActive && room?.escapeArea?.isRevealed && room?.settings.skillchecks?.enabled && escapeTimerRemaining > 0 && (
            <div className="mb-6 glass-card border-2 border-granny-survivor/50 bg-granny-survivor/10 p-4">
              <div className="text-4xl font-mono font-bold text-granny-survivor animate-pulse">
                🚪 {formatTime(escapeTimerRemaining)}
              </div>
              <p className="text-granny-survivor font-semibold">ESCAPE TIMER - Reach the escape area!</p>
              <p className="text-xs text-granny-text-muted mt-2">⚠️ Auto-elimination if time expires</p>
            </div>
          )}

          <div className="flex justify-center">
            <div className={`glass-card px-6 py-3 border-2 ${
              currentPlayer?.role === 'killer' 
                ? 'border-granny-danger/50 bg-granny-danger/10' 
                : 'border-granny-survivor/50 bg-granny-survivor/10'
            }`}>
              <span className="font-semibold text-granny-text">
                Your role: <span className={`font-bold ${
                  currentPlayer?.role === 'killer' ? 'text-granny-danger' : 'text-granny-survivor'
                }`}>
                  {currentPlayer?.role === 'killer' ? '🔪 KILLER' : '🛡️ SURVIVOR'}
                </span>
              </span>
            </div>
          </div>

          {/* Game Status Indicators */}
          {room.settings.skillchecks?.enabled && currentPlayer?.role === 'survivor' && isActive && (
            <div className="mt-6 space-y-4">
              {/* Skillcheck Progress */}
              {room.skillchecks && room.skillchecks.length > 0 && (
                <div className="glass-card border border-granny-survivor/30 bg-granny-survivor/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-granny-survivor flex items-center gap-2">
                      ⚡ Skillcheck Progress
                    </span>
                    <span className="text-xs text-granny-survivor font-mono bg-granny-survivor/20 px-2 py-1 rounded">
                      {room.skillchecks.filter(sc => sc.isCompleted).length} / {room.skillchecks.length}
                    </span>
                  </div>
                  <div className="w-full bg-granny-surface rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-granny-survivor/60 to-granny-survivor h-3 rounded-full transition-all duration-500 shadow-sm"
                      style={{ 
                        width: `${(room.skillchecks.filter(sc => sc.isCompleted).length / room.skillchecks.length) * 100}%` 
                      }}
                    />
                  </div>
                  {(room.allskillcheckscompleted || room.allSkillchecksCompleted) && (
                    <div className="text-xs text-granny-success mt-2 font-semibold animate-pulse flex items-center gap-1">
                      ✅ All skillchecks completed! Escape area revealed.
                    </div>
                  )}
                </div>
              )}

              {/* Escape Area Status */}
              {room.escapeArea?.isRevealed && (
                <div className="glass-card border border-granny-survivor/50 bg-granny-survivor/10 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-granny-survivor flex items-center gap-2">
                      🚪 Escape Area Active
                    </span>
                    {room.escapeArea.escapedPlayers.length > 0 && (
                      <span className="text-xs text-granny-success font-mono bg-granny-success/20 px-2 py-1 rounded">
                        {room.escapeArea.escapedPlayers.length} escaped
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-granny-text-muted flex items-start gap-2">
                    <span className="text-granny-survivor">🗺️</span>
                    <div>
                      Find the purple door on the map to escape!{' '}
                      {escapeTimerRemaining > 0 && (
                        <span className="text-granny-warning font-semibold">
                          {Math.ceil(escapeTimerRemaining / 60000)} min left!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Player Escaped Status */}
              {currentPlayer.hasEscaped && (
                <div className="glass-card border border-granny-success/50 bg-granny-success/10 p-4">
                  <div className="text-sm font-semibold text-granny-success flex items-center gap-2">
                    🎉 You Escaped!
                  </div>
                  <div className="text-xs text-granny-success mt-2">
                    Congratulations! You&apos;ve won the game for all survivors.
                  </div>
                  <div className="text-xs text-granny-text-muted mt-1 flex items-center gap-1">
                    ⏳ Game should end automatically...
                  </div>
                </div>
              )}

              {/* Manual Escape Button for Testing */}
              {user?.id === room.host_uid && nearbyEscapeArea && !currentPlayer.hasEscaped && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <button
                    onClick={handleEscape}
                    disabled={escaping}
                    className="w-full bg-purple-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-purple-600 disabled:opacity-50"
                  >
                    {escaping ? '⏳ Escaping...' : '🏃 Manual Escape (Testing)'}
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
          <div className="mb-6 space-y-4">
            <div className="glass-card border border-granny-error/30 bg-granny-error/5 p-6">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">💀</div>
                <div className="text-granny-error font-bold text-lg">
                  Survivor Emergency
                </div>
              </div>
              <button
                onClick={handleEliminate}
                disabled={eliminating}
                className="w-full bg-granny-error hover:bg-granny-error/90 text-white font-bold py-4 px-8 rounded-xl text-lg disabled:opacity-50 shadow-xl hover:shadow-granny-error/30 transition-all duration-300 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
              >
                {eliminating ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Reporting Death...</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">⚡</span>
                    <span>I Was Caught!</span>
                  </>
                )}
              </button>
              <div className="glass-card border border-granny-warning/20 bg-granny-warning/10 p-3 mt-4">
                <p className="text-xs text-granny-warning font-medium text-center flex items-center justify-center gap-2">
                  ⚠️ Only press if you were physically tagged by a killer
                </p>
              </div>
            </div>
            
            {/* Practice Skillcheck Button (only if skillchecks are enabled) */}
            {room?.settings.skillchecks?.enabled && (
              <div className="glass-card border border-granny-survivor/30 bg-granny-survivor/5 p-6">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">⚡</div>
                  <div className="text-granny-survivor font-bold text-lg">
                    Skillcheck Training
                  </div>
                </div>
                <button
                  onClick={() => setShowPracticeSkillcheck(true)}
                  className="w-full bg-granny-survivor hover:bg-granny-survivor/90 text-white font-bold py-4 px-6 rounded-xl shadow-xl hover:shadow-granny-survivor/30 transition-all duration-300 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-2xl">🎯</span>
                  <span>Practice Mode</span>
                </button>
                <div className="glass-card border border-granny-text-muted/20 bg-granny-text-muted/5 p-3 mt-4">
                  <p className="text-xs text-granny-text-muted text-center flex items-center justify-center gap-2">
                    🎮 Perfect your timing before the real challenge
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {currentPlayer?.isAlive && currentPlayer?.role === 'killer' && isActive && (
          <div className="mb-6">
            <div className="glass-card border border-granny-danger/50 bg-granny-danger/10 p-6">
              <div className="text-center mb-4">
                <div className="font-bold text-2xl mb-3 text-granny-danger animate-glow flex items-center justify-center gap-2">
                  🔪 You are a KILLER!
                </div>
                <p className="text-sm text-granny-text flex items-center justify-center gap-2">
                  🏃 Hunt down the survivors! They have{' '}
                  <span className="font-bold text-granny-danger">
                    {Math.max(0, Math.floor(timeRemaining / 60000))} minutes
                  </span>{' '}
                  left to hide.
                </p>
              </div>
              
              {/* Killer notifications for skillcheck progress */}
              {room?.settings.skillchecks?.enabled && room?.skillchecks && (
                <div className="mt-4 pt-4 border-t border-granny-danger/30">
                  <div className="text-xs font-semibold text-granny-danger mb-2 flex items-center gap-2">
                    ⚡ Skillcheck Progress
                  </div>
                  <div className="text-xs text-granny-text-muted mb-3 flex items-center gap-2">
                    📊 {room.skillchecks.filter(sc => sc.isCompleted).length} / {room.skillchecks.length} completed by survivors
                  </div>
                  {(room.allskillcheckscompleted || room.allSkillchecksCompleted) && (
                    <div className="glass-card text-xs bg-granny-error/20 border border-granny-error/50 text-granny-error px-3 py-2 rounded-lg mt-2 animate-pulse">
                      🚨 ALL SKILLCHECKS COMPLETE - Escape area is now active!
                    </div>
                  )}
                  {room.escapeArea?.isRevealed && !(room.allskillcheckscompleted || room.allSkillchecksCompleted) && (
                    <div className="glass-card text-xs bg-granny-error/20 border border-granny-error/50 text-granny-error px-3 py-2 rounded-lg mt-2 animate-pulse">
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
            <div className="glass-card border border-granny-border/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-semibold flex items-center gap-2 ${
                  currentPlayer?.role === 'killer' ? 'text-granny-danger' : 'text-granny-survivor'
                }`}>
                  🗺️ {currentPlayer?.role === 'killer' ? 'Tracking Map' : 'Survivor Map'}
                </h2>
                <button
                  onClick={() => setShowMap(!showMap)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    currentPlayer?.role === 'killer' 
                      ? 'bg-granny-danger/20 text-granny-danger border border-granny-danger/50 hover:bg-granny-danger/30' 
                      : 'bg-granny-survivor/20 text-granny-survivor border border-granny-survivor/50 hover:bg-granny-survivor/30'
                  }`}
                >
                  {showMap ? '👁️ Hide Map' : '🗺️ Show Map'}
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
                <div className={`glass-card border-2 border-dashed p-6 text-center ${
                  currentPlayer?.role === 'killer' 
                    ? 'border-granny-danger/30 bg-granny-danger/5' 
                    : 'border-granny-survivor/30 bg-granny-survivor/5'
                }`}>
                  <div className="text-4xl mb-2">🗺️</div>
                  <p className={`text-sm font-medium ${
                    currentPlayer?.role === 'killer' ? 'text-granny-danger' : 'text-granny-survivor'
                  }`}>
                    Click &quot;Show Map&quot; to see {currentPlayer?.role === 'killer' ? 'survivor locations' : 'your location and other survivors'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!currentPlayer?.isAlive && (
          <div className="mb-6">
            <div className="text-center mb-6">
              <div className="glass-card border border-granny-text-muted/30 bg-granny-text-muted/10 p-6">
                <div className="text-6xl mb-4">💀</div>
                <div className="font-bold text-xl mb-3 text-granny-text">You have been eliminated</div>
                <p className="text-sm text-granny-text-muted">
                  Watch the remaining players battle it out!
                </p>
              </div>
            </div>
            
            {/* Spectator Map */}
            {isActive && (
              <div className="glass-card border border-granny-border/30 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-granny-text flex items-center gap-2">
                    👻 Spectator Map
                  </h2>
                  <button
                    onClick={() => setShowMap(!showMap)}
                    className="px-4 py-2 bg-granny-surface border border-granny-border text-granny-text rounded-lg hover:bg-granny-surface-light text-sm font-semibold transition-all duration-200"
                  >
                    {showMap ? '👁️ Hide Map' : '🗺️ Show Map'}
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
            <h2 className="text-lg font-semibold mb-4 text-granny-danger flex items-center gap-2">
              🔪 Killers ({aliveKillers.length})
            </h2>
            <div className="space-y-3">
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
            <h2 className="text-lg font-semibold mb-4 text-granny-survivor flex items-center gap-2">
              🛡️ Survivors ({aliveSurvivors.length})
            </h2>
            <div className="space-y-3">
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
            <h2 className="text-lg font-semibold mb-4 text-granny-error flex items-center gap-2">
              💀 Eliminated ({deadPlayers.length})
            </h2>
            <div className="space-y-3">
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
            <h2 className="text-lg font-semibold mb-4 text-granny-success flex items-center gap-2">
              🎉 Escaped ({escapedPlayers.length})
            </h2>
            <div className="space-y-3">
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
          className="btn-ghost px-6 py-3"
        >
          🏠 Back to Room
        </button>
      </div>

      {/* Location Error Display */}
      {locationError && (
        <div className="mt-4 glass-card p-4 border border-granny-warning/30 bg-granny-warning/10">
          <p className="text-granny-warning text-sm font-medium flex items-center gap-2">
            ⚠️ {locationError}
          </p>
        </div>
      )}

      {/* Location Status */}
      {locationEnabled && (
        <div className="mt-4 glass-card p-4 border border-granny-success/30 bg-granny-success/10">
          <p className="text-granny-success text-sm font-medium flex items-center gap-2">
            📍 Location sharing enabled
          </p>
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

      {/* Background Notifications - Non-intrusive prompts */}
      {currentPlayer?.isAlive && currentPlayer?.role === 'survivor' && isActive && (
        <div className="fixed bottom-20 right-4 z-30 space-y-2 max-w-xs">
          {/* Background Skillcheck Notification */}
          {backgroundSkillcheck && (
            <div className="glass-card border border-granny-warning/50 bg-granny-warning/90 text-white rounded-lg p-3 shadow-xl animate-pulse cursor-pointer hover:bg-granny-warning transition-all duration-200 hover:scale-105"
                 onClick={() => {
                   setActiveSkillcheck(backgroundSkillcheck);
                   setBackgroundSkillcheck(null);
                 }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div className="text-left">
                  <div className="font-bold text-sm">Skillcheck Nearby!</div>
                  <div className="text-xs opacity-90">Tap to complete</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Background Escape Notification */}
          {backgroundEscape && !escaping && (
            <div className="glass-card border border-purple-400/50 bg-purple-500/90 text-white rounded-lg p-3 shadow-xl animate-pulse cursor-pointer hover:bg-purple-500 transition-all duration-200 hover:scale-105"
                 onClick={handleEscape}>
              <div className="flex items-center gap-2">
                <span className="text-xl">🚪</span>
                <div className="text-left">
                  <div className="font-bold text-sm">Escape Area!</div>
                  <div className="text-xs opacity-90">Tap to escape</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Skillcheck Proximity Prompt */}
      {showSkillcheckPrompt && !activeSkillcheck && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="glass-modal max-w-md w-full text-granny-text text-center animate-slide-up">
            <div className="p-6">
              <div className="text-4xl mb-4">⚡</div>
              <div className="text-2xl font-bold text-granny-warning mb-4">Skillcheck Detected!</div>
              <p className="text-granny-text-muted mb-6">
                You&apos;re near a skillcheck. Complete it to help your team progress!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setActiveSkillcheck(showSkillcheckPrompt);
                    setShowSkillcheckPrompt(null);
                  }}
                  className="btn-primary flex-1 py-3"
                >
                  ⚡ Start Skillcheck
                </button>
                <button
                  onClick={() => {
                    // Dismiss the modal and add to dismissed set
                    setDismissedSkillcheckPrompts(prev => {
                      const newSet = new Set(prev);
                      newSet.add(showSkillcheckPrompt!);
                      return newSet;
                    });
                    setShowSkillcheckPrompt(null);
                    // Show in background instead
                    setBackgroundSkillcheck(showSkillcheckPrompt);
                  }}
                  className="btn-ghost flex-1 py-3"
                >
                  🕰️ Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Escape Area Proximity Prompt */}
      {showEscapePrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="glass-modal max-w-md w-full text-granny-text text-center animate-slide-up">
            <div className="p-6">
              <div className="text-4xl mb-4">🚪</div>
              <div className="text-2xl font-bold text-purple-400 mb-4">Escape Area Found!</div>
              <p className="text-granny-text-muted mb-6">
                You&apos;ve reached the escape zone! Escape now to save yourself!
                {escapeTimerRemaining > 0 && (
                  <span className="block mt-2 text-granny-warning font-semibold">
                    ⏰ Time left: {Math.ceil(escapeTimerRemaining / 1000)}s
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleEscape}
                  disabled={escaping}
                  className="btn-secondary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {escaping ? '⏳ Escaping...' : '🏃 ESCAPE NOW!'}
                </button>
                <button
                  onClick={() => {
                    // Dismiss the modal and mark as dismissed
                    setDismissedEscapePrompt(true);
                    setShowEscapePrompt(false);
                    // Show in background instead
                    setBackgroundEscape(true);
                  }}
                  className="btn-ghost flex-1 py-3"
                >
                  ⏳ Not Yet
                </button>
              </div>
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

      {/* Skillcheck Success Prompt - Highest Priority */}
      {showSkillcheckSuccess && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
          <div className="glass-modal max-w-sm w-full mx-4 text-center animate-slide-up pointer-events-auto">
            <div className="p-6">
              <div className="text-6xl mb-4 animate-bounce">✅</div>
              <div className="text-2xl font-bold text-granny-success mb-2">
                Skillcheck Complete!
              </div>
              <p className="text-granny-text-muted text-sm">
                Great timing! Keep it up.
              </p>
              <div className="mt-4">
                <div className="w-full bg-granny-surface rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-granny-success/60 to-granny-success h-2 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>
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
    const roleColor = player.role === 'killer' ? 'granny-danger' : 'granny-survivor';
    
    return {
      container: `glass-card p-4 border transition-all duration-200 ${
        isInactive 
          ? 'border-granny-text-muted/30 bg-granny-text-muted/10 opacity-75' 
          : `border-${roleColor}/30 hover:border-${roleColor}/50`
      } ${canClick && player.location ? 'cursor-pointer hover:scale-[1.02]' : ''}`,
      name: `font-semibold text-granny-text ${isInactive ? 'line-through opacity-75' : ''}`
    };
  }, [player.isAlive, player.hasEscaped, player.role, canClick, player.location]);

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
        <div className="relative">
          <img
            src={player.profilePictureUrl}
            alt={player.displayName}
            className={`w-12 h-12 rounded-full object-cover border-2 ${
              player.role === 'killer' 
                ? 'border-granny-danger/50' 
                : 'border-granny-survivor/50'
            }`}
          />
          {player.hasEscaped && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-granny-success rounded-full flex items-center justify-center">
              <span className="text-xs">🎉</span>
            </div>
          )}
          {!player.isAlive && !player.hasEscaped && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-granny-error rounded-full flex items-center justify-center">
              <span className="text-xs">💀</span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
            player.role === 'killer' 
              ? 'bg-granny-danger/20 border-granny-danger/50' 
              : 'bg-granny-survivor/20 border-granny-survivor/50'
          }`}>
            <span className="text-lg font-bold text-granny-text">
              {player.displayName[0]?.toUpperCase()}
            </span>
          </div>
          {player.hasEscaped && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-granny-success rounded-full flex items-center justify-center">
              <span className="text-xs">🎉</span>
            </div>
          )}
          {!player.isAlive && !player.hasEscaped && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-granny-error rounded-full flex items-center justify-center">
              <span className="text-xs">💀</span>
            </div>
          )}
        </div>
      )}
      <div className="flex-1">
        <p className={cardStyles.name}>
          {player.displayName}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            player.role === 'killer' 
              ? 'bg-granny-danger/20 text-granny-danger' 
              : 'bg-granny-survivor/20 text-granny-survivor'
          }`}>
            {player.role === 'killer' ? '🔪' : '🛡️'} {player.role?.toUpperCase()}
          </span>
          {player.hasEscaped && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-granny-success/20 text-granny-success">
              🎉 ESCAPED
            </span>
          )}
          {!player.isAlive && !player.hasEscaped && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-granny-error/20 text-granny-error">
              💀 ELIMINATED
            </span>
          )}
        </div>
        {statusTime && (
          <p className="text-xs text-granny-text-muted mt-1 flex items-center gap-1">
            ⏰ {statusTime.type === 'escaped' ? 'Escaped' : 'Eliminated'} at {statusTime.time}
          </p>
        )}
      </div>
      
      <div className="flex flex-col items-center gap-1">
        {player.hasEscaped && <div className="text-3xl animate-bounce">🎉</div>}
        {!player.isAlive && !player.hasEscaped && <div className="text-2xl text-granny-error">💀</div>}
        {player.isAlive && !player.hasEscaped && (
          <div className={`text-2xl ${
            player.role === 'killer' ? 'text-granny-danger' : 'text-granny-survivor'
          }`}>
            {player.role === 'killer' ? '🔪' : '🛡️'}
          </div>
        )}
      </div>
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