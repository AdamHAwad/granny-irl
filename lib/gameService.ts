/**
 * Game Service - Core business logic for Granny IRL
 * 
 * Handles:
 * - Room management (create, join, leave, kick)
 * - Game state transitions (waiting → headstart → active → finished)
 * - Player elimination and game end detection
 * - Real-time subscriptions with polling fallback
 * - Location tracking integration
 * - Game history and statistics
 * 
 * Key patterns:
 * - All database operations go through Supabase client
 * - Real-time updates via subscriptions + 2s polling fallback
 * - Comprehensive logging for debugging
 * - Resilient error handling for free tier limitations
 */

import { supabase } from './supabase';
import { Room, Player, RoomSettings, GameResult, PlayerGameStats, GameHistoryEntry, PlayerLocation } from '@/types/game';

/**
 * Generates a random 6-digit room code (e.g., "ABC123")
 * Uses base36 for alphanumeric codes that are easy to share
 */
export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(
  hostUid: string,
  hostProfile: { displayName: string; profilePictureUrl?: string },
  settings: RoomSettings
): Promise<string> {
  try {
    let roomCode: string;
    let attempts = 0;
    
    do {
      roomCode = generateRoomCode();
      attempts++;
      if (attempts > 10) {
        throw new Error('Could not generate unique room code');
      }
    } while (await roomExists(roomCode));

    const room: Room = {
      id: roomCode,
      host_uid: hostUid,
      players: {
        [hostUid]: {
          uid: hostUid,
          displayName: hostProfile.displayName,
          profilePictureUrl: hostProfile.profilePictureUrl,
          isAlive: true,
        },
      },
      settings,
      status: 'waiting',
      created_at: Date.now(),
    };

    const { error } = await supabase
      .from('rooms')
      .insert(room);

    if (error) throw error;
    return roomCode;
  } catch (error: any) {
    console.error('Database error in createRoom:', error);
    throw error;
  }
}

export async function roomExists(roomCode: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id')
    .eq('id', roomCode)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

export async function joinRoom(
  roomCode: string,
  playerUid: string,
  playerProfile: { displayName: string; profilePictureUrl?: string }
): Promise<Room | null> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomCode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  if (room.status !== 'waiting') {
    throw new Error('Game has already started');
  }

  if (Object.keys(room.players).length >= room.settings.maxPlayers) {
    throw new Error('Room is full');
  }

  const player: Player = {
    uid: playerUid,
    displayName: playerProfile.displayName,
    profilePictureUrl: playerProfile.profilePictureUrl,
    isAlive: true,
  };

  const updatedPlayers = { ...room.players, [playerUid]: player };

  const { error: updateError } = await supabase
    .from('rooms')
    .update({ players: updatedPlayers })
    .eq('id', roomCode);

  if (updateError) throw updateError;
  
  return { ...room, players: updatedPlayers };
}

export async function leaveRoom(roomCode: string, playerUid: string): Promise<void> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomCode)
    .single();

  if (error) return;

  if (room.host_uid === playerUid) {
    const { error: deleteError } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomCode);
    
    if (deleteError) throw deleteError;
  } else {
    const updatedPlayers = { ...room.players };
    delete updatedPlayers[playerUid];

    const { error: updateError } = await supabase
      .from('rooms')
      .update({ players: updatedPlayers })
      .eq('id', roomCode);

    if (updateError) throw updateError;
  }
}

export async function kickPlayer(
  roomCode: string,
  hostUid: string,
  playerToKickUid: string
): Promise<void> {
  console.log('kickPlayer: Host', hostUid, 'kicking player', playerToKickUid, 'from room', roomCode);
  
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomCode)
    .single();

  if (error) {
    console.error('kickPlayer: Error fetching room:', error);
    throw new Error('Room not found');
  }

  // Verify the person kicking is the host
  if (room.host_uid !== hostUid) {
    console.error('kickPlayer: Only host can kick players');
    throw new Error('Only the host can kick players');
  }

  // Can't kick yourself
  if (hostUid === playerToKickUid) {
    console.error('kickPlayer: Host cannot kick themselves');
    throw new Error('Host cannot kick themselves');
  }

  // Check if player exists in room
  if (!room.players[playerToKickUid]) {
    console.error('kickPlayer: Player not found in room');
    throw new Error('Player not found in room');
  }

  // Remove player from room
  const updatedPlayers = { ...room.players };
  delete updatedPlayers[playerToKickUid];

  const { error: updateError } = await supabase
    .from('rooms')
    .update({ players: updatedPlayers })
    .eq('id', roomCode);

  if (updateError) {
    console.error('kickPlayer: Error updating room:', updateError);
    throw updateError;
  }

  console.log('kickPlayer: Successfully kicked player', playerToKickUid);
}

export async function startGame(roomCode: string): Promise<void> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomCode)
    .single();

  if (error) throw new Error('Room not found');

  const playerUids = Object.keys(room.players);
  
  if (playerUids.length < 2) {
    throw new Error('Need at least 2 players to start');
  }

  if (playerUids.length < room.settings.killerCount + 1) {
    throw new Error(`Need at least ${room.settings.killerCount + 1} players for ${room.settings.killerCount} killer(s)`);
  }

  const shuffled = [...playerUids].sort(() => Math.random() - 0.5);
  const killers = shuffled.slice(0, room.settings.killerCount);
  const survivors = shuffled.slice(room.settings.killerCount);

  const updatedPlayers = { ...room.players };
  killers.forEach(uid => {
    updatedPlayers[uid].role = 'killer';
  });
  survivors.forEach(uid => {
    updatedPlayers[uid].role = 'survivor';
  });

  const { error: updateError } = await supabase
    .from('rooms')
    .update({
      status: 'headstart',
      headstart_started_at: Date.now(),
      players: updatedPlayers,
    })
    .eq('id', roomCode);

  if (updateError) throw updateError;

  // Auto-transition from headstart to active after headstart time
  setTimeout(async () => {
    try {
      console.log('Headstart timer expired, transitioning to active phase for room:', roomCode);
      
      // Re-fetch room to get current settings
      const { data: currentRoom, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomCode)
        .single();

      if (fetchError || !currentRoom) {
        console.error('Error fetching room for transition:', fetchError);
        return;
      }

      const { error } = await supabase
        .from('rooms')
        .update({
          status: 'active',
          game_started_at: Date.now(),
        })
        .eq('id', roomCode);

      if (error) {
        console.error('Error transitioning to active:', error);
      } else {
        console.log('Game transitioned to active phase');
        const gameDurationMs = currentRoom.settings.roundLengthMinutes * 60 * 1000;
        console.log('Setting game end timer for', gameDurationMs, 'ms (', currentRoom.settings.roundLengthMinutes, 'minutes )');
        
        // Start game end timer using current room settings
        setTimeout(async () => {
          console.log('Game timer expired, checking game end for room:', roomCode);
          await checkGameEnd(roomCode);
        }, gameDurationMs);
      }
    } catch (error) {
      console.error('Error in game transition:', error);
    }
  }, room.settings.headstartMinutes * 60 * 1000);
}

export async function eliminatePlayer(
  roomCode: string,
  playerUid: string,
  eliminatedBy?: string
): Promise<void> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomCode)
    .single();

  if (error) throw error;

  const updatedPlayers = { ...room.players };
  updatedPlayers[playerUid].isAlive = false;
  updatedPlayers[playerUid].eliminatedAt = Date.now();
  if (eliminatedBy) {
    updatedPlayers[playerUid].eliminatedBy = eliminatedBy;
  }

  const { error: updateError } = await supabase
    .from('rooms')
    .update({ players: updatedPlayers })
    .eq('id', roomCode);

  if (updateError) throw updateError;
  
  await checkGameEnd(roomCode);
}

export async function checkGameEnd(roomCode: string): Promise<void> {
  console.log('checkGameEnd: Called for room', roomCode);
  
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomCode)
    .single();

  if (error) {
    console.log('checkGameEnd: Room not found or error:', error);
    return;
  }

  console.log('checkGameEnd: Room status:', room.status, 'game_started_at:', room.game_started_at);

  const players = Object.values(room.players);
  const aliveKillers = players.filter((p: any) => p.role === 'killer' && p.isAlive);
  const aliveSurvivors = players.filter((p: any) => p.role === 'survivor' && p.isAlive);

  console.log('checkGameEnd: Alive killers:', aliveKillers.length, 'Alive survivors:', aliveSurvivors.length);

  let gameEnded = false;
  let winners: 'killers' | 'survivors' | null = null;

  if (aliveSurvivors.length === 0) {
    console.log('checkGameEnd: Game ended - no survivors left');
    gameEnded = true;
    winners = 'killers';
  } else if (room.game_started_at && room.status === 'active') {
    const gameLength = room.settings.roundLengthMinutes * 60 * 1000;
    const gameEndTime = room.game_started_at + gameLength;
    const now = Date.now();
    const timeElapsed = now - room.game_started_at;
    
    console.log('checkGameEnd: Game length:', gameLength, 'ms, End time:', gameEndTime, 'Current time:', now, 'Time elapsed:', timeElapsed, 'Time remaining:', gameEndTime - now);
    
    // Only check for time-based ending if the game has been active for at least 5 seconds
    // This prevents premature ending during transitions
    if (timeElapsed >= 5000 && now >= gameEndTime) {
      console.log('checkGameEnd: Game ended - time expired');
      gameEnded = true;
      winners = 'survivors';
    }
  } else {
    console.log('checkGameEnd: Game not ending - status:', room.status, 'game_started_at:', room.game_started_at);
  }

  if (gameEnded && winners) {
    const eliminationOrder = players
      .filter((p: any) => !p.isAlive)
      .sort((a: any, b: any) => (a.eliminatedAt || 0) - (b.eliminatedAt || 0))
      .map((p: any) => p.uid);

    const gameResult: GameResult = {
      room_id: roomCode,
      winners,
      elimination_order: eliminationOrder,
      game_started_at: room.game_started_at!,
      game_ended_at: Date.now(),
      final_players: room.players,
    };

    await Promise.all([
      supabase
        .from('rooms')
        .update({
          status: 'finished',
          game_ended_at: Date.now(),
        })
        .eq('id', roomCode),
      supabase
        .from('game_results')
        .insert(gameResult),
    ]);

    // Auto-reset room for new game after 10 seconds
    setTimeout(async () => {
      await resetRoomForNewGame(roomCode);
    }, 10000);
  }
}

export async function resetRoomForNewGame(roomCode: string): Promise<void> {
  try {
    console.log('resetRoomForNewGame: Resetting room for new game:', roomCode);
    
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomCode)
      .single();

    if (error || !room) {
      console.log('resetRoomForNewGame: Room not found or error:', error);
      return;
    }

    // Reset all players to alive with no roles
    const resetPlayers = { ...room.players };
    Object.keys(resetPlayers).forEach(uid => {
      resetPlayers[uid] = {
        ...resetPlayers[uid],
        isAlive: true,
        role: undefined,
        eliminatedAt: undefined,
        eliminatedBy: undefined,
      };
    });

    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        status: 'waiting',
        players: resetPlayers,
        headstart_started_at: null,
        game_started_at: null,
        game_ended_at: null,
      })
      .eq('id', roomCode);

    if (updateError) {
      console.error('resetRoomForNewGame: Error resetting room:', updateError);
    } else {
      console.log('resetRoomForNewGame: Room reset successfully');
    }
  } catch (error) {
    console.error('resetRoomForNewGame: Error:', error);
  }
}

export function subscribeToRoom(
  roomCode: string,
  callback: (room: Room | null) => void
): () => void {
  console.log('subscribeToRoom: Setting up optimized real-time subscription for room:', roomCode);
  
  let isActive = true;
  
  // Initial fetch
  const fetchInitialData = async () => {
    if (!isActive) return;
    
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomCode)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('subscribeToRoom: Error fetching initial room data:', error);
        callback(null);
      } else {
        console.log('subscribeToRoom: Fetched initial room data');
        callback(data);
      }
    } catch (error) {
      console.error('subscribeToRoom: Initial fetch error:', error);
      callback(null);
    }
  };

  // Set up optimized real-time subscription with paid plan features
  const channel = supabase
    .channel(`room:${roomCode}`, {
      config: {
        presence: {
          key: roomCode,
        },
        broadcast: {
          self: false,
        },
      },
    })
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${roomCode}`
      }, 
      (payload) => {
        console.log('subscribeToRoom: Received real-time update:', payload.eventType);
        if (!isActive) return;
        
        if (payload.eventType === 'DELETE') {
          callback(null);
        } else {
          callback(payload.new as Room);
        }
      }
    )
    .subscribe(async (status) => {
      console.log('subscribeToRoom: Subscription status:', status);
      
      if (status === 'SUBSCRIBED') {
        // Fetch initial data only after subscription is ready
        await fetchInitialData();
      } else if (status === 'CHANNEL_ERROR') {
        console.error('subscribeToRoom: Channel error, attempting reconnect');
        // Auto-reconnect handled by Supabase
      }
    });

  return () => {
    console.log('subscribeToRoom: Cleaning up optimized subscription for room:', roomCode);
    isActive = false;
    supabase.removeChannel(channel);
  };
}

export async function getGameResult(roomCode: string): Promise<GameResult | null> {
  const { data, error } = await supabase
    .from('game_results')
    .select('*')
    .eq('room_id', roomCode)
    .order('game_ended_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

export async function getCurrentUserRooms(uid: string): Promise<Room[]> {
  try {
    // Optimized query: use PostgreSQL to filter on server side
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .in('status', ['waiting', 'headstart', 'active'])
      .contains('players', { [uid]: {} }); // Filter rooms containing the user

    if (error) {
      // Fallback to client-side filtering if contains doesn't work
      const { data: allData, error: fallbackError } = await supabase
        .from('rooms')
        .select('*')
        .in('status', ['waiting', 'headstart', 'active']);
        
      if (fallbackError) throw fallbackError;
      
      const userRooms = (allData || []).filter((room: Room) => 
        room.players && room.players[uid]
      );
      
      return userRooms;
    }

    console.log('getCurrentUserRooms: Found rooms for user:', uid, data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('Error fetching user rooms:', error);
    return [];
  }
}

export async function getPlayerGameHistory(uid: string): Promise<GameHistoryEntry[]> {
  try {
    console.log('getPlayerGameHistory: Fetching history for user:', uid);
    
    const { data, error } = await supabase
      .from('game_results')
      .select('*')
      .order('game_ended_at', { ascending: false });

    if (error) throw error;

    // Filter games where the user participated and transform to GameHistoryEntry
    const userGames: GameHistoryEntry[] = (data || [])
      .filter((result: GameResult) => result.final_players[uid])
      .map((result: GameResult) => {
        const player = result.final_players[uid];
        const playerRole = player.role!;
        const playerWon = 
          (playerRole === 'killer' && result.winners === 'killers') ||
          (playerRole === 'survivor' && result.winners === 'survivors');
        
        // Calculate placement (1 = winner, higher = eliminated earlier)
        let placement = 1; // Default to winner
        if (!playerWon) {
          if (player.isAlive) {
            // Survived but lost (time ran out, killers won)
            placement = Object.values(result.final_players)
              .filter(p => p.role === playerRole && !p.isAlive).length + 1;
          } else {
            // Was eliminated - find position in elimination order
            const eliminationIndex = result.elimination_order.indexOf(uid);
            placement = eliminationIndex !== -1 ? 
              result.elimination_order.length - eliminationIndex + 1 : 
              Object.keys(result.final_players).length;
          }
        }

        const gameDurationMinutes = 
          (result.game_ended_at - result.game_started_at) / (1000 * 60);

        return {
          room_id: result.room_id,
          winners: result.winners,
          game_started_at: result.game_started_at,
          game_ended_at: result.game_ended_at,
          playerRole,
          playerWon,
          placement,
          gameDurationMinutes: Math.round(gameDurationMinutes * 10) / 10, // Round to 1 decimal
        };
      });

    console.log('getPlayerGameHistory: Found', userGames.length, 'games for user:', uid);
    return userGames;
  } catch (error) {
    console.error('Error fetching player game history:', error);
    return [];
  }
}

export async function getPlayerGameStats(uid: string): Promise<PlayerGameStats> {
  try {
    const history = await getPlayerGameHistory(uid);
    
    const stats: PlayerGameStats = {
      gamesPlayed: history.length,
      wins: history.filter(game => game.playerWon).length,
      losses: history.filter(game => !game.playerWon).length,
      killerWins: history.filter(game => game.playerRole === 'killer' && game.playerWon).length,
      survivorWins: history.filter(game => game.playerRole === 'survivor' && game.playerWon).length,
      avgPlacement: history.length > 0 ? 
        Math.round((history.reduce((sum, game) => sum + game.placement, 0) / history.length) * 10) / 10 : 0,
      totalEliminations: history.filter(game => !game.playerWon && game.placement > 1).length,
    };

    console.log('getPlayerGameStats: Calculated stats for user:', uid, stats);
    return stats;
  } catch (error) {
    console.error('Error calculating player game stats:', error);
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      killerWins: 0,
      survivorWins: 0,
      avgPlacement: 0,
      totalEliminations: 0,
    };
  }
}

// Cache for room status to avoid unnecessary fetches
const roomStatusCache = new Map<string, { status: string, timestamp: number }>();
const CACHE_DURATION = 10000; // 10 seconds

// Clear room status cache (useful when game state changes)
export function clearRoomStatusCache(roomCode?: string): void {
  if (roomCode) {
    roomStatusCache.delete(roomCode);
    console.log('Cleared room status cache for:', roomCode);
  } else {
    roomStatusCache.clear();
    console.log('Cleared all room status cache');
  }
}

export async function updatePlayerLocation(
  roomCode: string,
  playerUid: string,
  location: PlayerLocation
): Promise<void> {
  try {
    // Clear cache at start of new game sessions to avoid stale data
    const now = Date.now();
    const cached = roomStatusCache.get(roomCode);
    
    let roomStatus = cached?.status;
    if (!cached || (now - cached.timestamp) > CACHE_DURATION) {
      // Fetch only the status and check if player exists, not full room data
      const { data, error } = await supabase
        .from('rooms')
        .select('status, players')
        .eq('id', roomCode)
        .single();

      if (error) {
        console.error('updatePlayerLocation: Error fetching room status:', error);
        return;
      }

      if (!data.players[playerUid]) {
        console.error('updatePlayerLocation: Player not found in room');
        return;
      }

      roomStatus = data.status;
      if (roomStatus) {
        roomStatusCache.set(roomCode, { status: roomStatus, timestamp: now });
      }
    }

    // Only update location during active games
    if (roomStatus !== 'active' && roomStatus !== 'headstart') {
      console.log('updatePlayerLocation: Not updating location - game not active');
      return;
    }

    // Direct update using fallback method (RPC function doesn't exist)
    await updatePlayerLocationFallback(roomCode, playerUid, location, now);
  } catch (error) {
    console.error('updatePlayerLocation: Error:', error);
  }
}

// Improved fallback function for location updates with error handling
async function updatePlayerLocationFallback(
  roomCode: string,
  playerUid: string,
  location: PlayerLocation,
  timestamp?: number
): Promise<void> {
  try {
    const { data: room, error } = await supabase
      .from('rooms')
      .select('players')
      .eq('id', roomCode)
      .single();

    if (error) {
      console.error('updatePlayerLocationFallback: Error fetching room:', error);
      throw new Error('Failed to fetch room data');
    }

    if (!room.players[playerUid]) {
      console.error('updatePlayerLocationFallback: Player not found in room:', playerUid);
      throw new Error('Player not found in room');
    }

    const updatedPlayers = { ...room.players };
    updatedPlayers[playerUid] = {
      ...updatedPlayers[playerUid],
      location,
      lastLocationUpdate: timestamp || Date.now(),
    };

    const { error: updateError } = await supabase
      .from('rooms')
      .update({ players: updatedPlayers })
      .eq('id', roomCode);

    if (updateError) {
      console.error('updatePlayerLocationFallback: Error updating players:', updateError);
      throw updateError;
    }

    console.log('updatePlayerLocationFallback: Successfully updated location for player:', playerUid);
  } catch (error) {
    console.error('updatePlayerLocationFallback: Error:', error);
    throw error;
  }
}

export async function clearPlayerLocation(
  roomCode: string,
  playerUid: string
): Promise<void> {
  try {
    console.log('clearPlayerLocation: Clearing location for player:', playerUid);
    
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomCode)
      .single();

    if (error || !room.players[playerUid]) {
      return;
    }

    // Clear player's location data
    const updatedPlayers = { ...room.players };
    updatedPlayers[playerUid] = {
      ...updatedPlayers[playerUid],
      location: undefined,
      lastLocationUpdate: undefined,
    };

    const { error: updateError } = await supabase
      .from('rooms')
      .update({ players: updatedPlayers })
      .eq('id', roomCode);

    if (updateError) {
      console.error('clearPlayerLocation: Error updating room:', updateError);
    } else {
      console.log('clearPlayerLocation: Successfully cleared location for player:', playerUid);
    }
  } catch (error) {
    console.error('clearPlayerLocation: Error:', error);
  }
}