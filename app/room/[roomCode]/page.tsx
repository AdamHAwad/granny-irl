'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { subscribeToRoom, leaveRoom, startGame, kickPlayer } from '@/lib/gameService';
import { Room } from '@/types/game';
import AuthGuard from '@/components/AuthGuard';

interface PageProps {
  params: {
    roomCode: string;
  };
}

function RoomPage({ params }: PageProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);

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
        console.log('User has been kicked from room:', user.id);
        setError('You have been removed from this room');
        setTimeout(() => router.push('/'), 2000);
        return;
      }

      setRoom(roomData);
      setLoading(false);

      if (roomData.status === 'headstart' || roomData.status === 'active') {
        router.push(`/game/${params.roomCode}`);
      }
    });

    return unsubscribe;
  }, [user, profile, params.roomCode, router]);

  const handleLeaveRoom = async () => {
    if (!user) return;
    
    try {
      await leaveRoom(params.roomCode, user.id);
      router.push('/');
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  const handleStartGame = async () => {
    if (!user || !room) return;

    setStarting(true);
    try {
      await startGame(params.roomCode);
    } catch (error: any) {
      setError(error.message || 'Failed to start game');
      setStarting(false);
    }
  };

  const handleKickPlayer = async (playerUid: string) => {
    if (!user || !room) return;

    setKicking(playerUid);
    try {
      await kickPlayer(params.roomCode, user.id, playerUid);
    } catch (error: any) {
      setError(error.message || 'Failed to kick player');
    } finally {
      setKicking(null);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="glass-card p-8 text-center animate-slide-up">
          <div className="text-xl text-granny-text mb-4 flex items-center justify-center gap-2">
            🏠 Loading room...
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
          <h1 className="text-2xl font-bold text-granny-text mb-4">Room Error</h1>
          <p className="text-granny-error mb-6">{error || 'Room not found'}</p>
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

  const players = Object.values(room.players);
  const isHost = user?.id === room.host_uid;
  const canStart = players.length >= 2 && players.length >= room.settings.killerCount + 1;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 max-w-2xl mx-auto relative">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-granny-bg/80 to-granny-bg pointer-events-none" />
      
      <div className="w-full glass-modal p-8 text-granny-text animate-slide-up relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-granny-text mb-2 flex items-center justify-center gap-2">
            🏠 Room {room.id}
          </h1>
          <p className="text-granny-text-muted">Share this code with friends to join the hunt</p>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-granny-text flex items-center gap-2">
            ⚙️ Game Settings
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 border border-granny-border/30 text-center">
              <div className="text-2xl font-bold text-granny-danger mb-1">{room.settings.killerCount}</div>
              <div className="text-sm text-granny-text-muted">🔪 Killers</div>
            </div>
            <div className="glass-card p-4 border border-granny-border/30 text-center">
              <div className="text-2xl font-bold text-granny-warning mb-1">{room.settings.roundLengthMinutes}</div>
              <div className="text-sm text-granny-text-muted">⏱️ Round (min)</div>
            </div>
            <div className="glass-card p-4 border border-granny-border/30 text-center">
              <div className="text-2xl font-bold text-granny-survivor mb-1">{room.settings.headstartMinutes}</div>
              <div className="text-sm text-granny-text-muted">🏃 Headstart (min)</div>
            </div>
            <div className="glass-card p-4 border border-granny-border/30 text-center">
              <div className="text-2xl font-bold text-granny-text mb-1">{room.settings.maxPlayers}</div>
              <div className="text-sm text-granny-text-muted">👥 Max Players</div>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-granny-text flex items-center gap-2">
            👥 Players ({players.length}/{room.settings.maxPlayers})
          </h2>
          <div className="space-y-3">
            {players.map((player) => (
              <div
                key={player.uid}
                className="glass-card p-4 border border-granny-border/30 hover:border-granny-border/50 transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  {player.profilePictureUrl ? (
                    <div className="relative">
                      <img
                        src={player.profilePictureUrl}
                        alt={player.displayName}
                        className="w-12 h-12 rounded-full object-cover border-2 border-granny-survivor/50"
                      />
                      {player.uid === room.host_uid && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-granny-warning rounded-full flex items-center justify-center">
                          <span className="text-xs">👑</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-granny-surface border-2 border-granny-border/50 flex items-center justify-center">
                        <span className="text-lg font-bold text-granny-text">
                          {player.displayName[0]?.toUpperCase()}
                        </span>
                      </div>
                      {player.uid === room.host_uid && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-granny-warning rounded-full flex items-center justify-center">
                          <span className="text-xs">👑</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-granny-text">{player.displayName}</p>
                    {player.uid === room.host_uid && (
                      <p className="text-xs text-granny-warning font-medium">👑 Host</p>
                    )}
                  </div>
                  {isHost && player.uid !== room.host_uid && (
                    <button
                      onClick={() => handleKickPlayer(player.uid)}
                      disabled={kicking === player.uid}
                      className="px-3 py-1 text-xs bg-granny-error hover:bg-granny-error/80 text-white rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {kicking === player.uid ? '⏳ Kicking...' : '🚫 Kick'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 glass-card p-4 border border-granny-error/30 bg-granny-error/10">
            <p className="text-granny-error text-sm font-medium flex items-center gap-2">
              ⚠️ {error}
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleLeaveRoom}
            className="btn-ghost flex-1 py-3"
          >
            🚪 Leave Room
          </button>
          
          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart || starting}
              className="btn-primary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Starting...</span>
                </div>
              ) : (
                <>🎮 Start Game</>
              )}
            </button>
          )}
        </div>

        {!canStart && isHost && (
          <p className="text-center text-sm text-granny-text-muted mt-4 flex items-center justify-center gap-1">
            ⚠️ Need at least {Math.max(2, room.settings.killerCount + 1)} players to start
          </p>
        )}
      </div>
    </main>
  );
}

export default function RoomPageWrapper({ params }: PageProps) {
  return (
    <AuthGuard fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-granny-bg/80 to-granny-bg pointer-events-none" />
        <div className="glass-card p-8 text-center animate-slide-up relative z-10">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-granny-text text-lg mb-4">Please sign in to access this room</p>
          <p className="text-granny-text-muted text-sm">Join the hunt with other players</p>
        </div>
      </main>
    }>
      <RoomPage params={params} />
    </AuthGuard>
  );
}