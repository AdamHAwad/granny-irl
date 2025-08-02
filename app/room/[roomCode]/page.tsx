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
        <div className="text-lg">Loading room...</div>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Room Error</h1>
          <p className="text-red-600 mb-4">{error || 'Room not found'}</p>
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

  const players = Object.values(room.players);
  const isHost = user?.id === room.host_uid;
  const canStart = players.length >= 2 && players.length >= room.settings.killerCount + 1;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 max-w-2xl mx-auto">
      <div className="w-full bg-white rounded-lg shadow-lg p-6 text-black">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">Room {room.id}</h1>
          <p className="text-gray-600">Share this code with friends</p>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Game Settings</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Killers:</span> {room.settings.killerCount}
            </div>
            <div>
              <span className="font-medium">Round Length:</span> {room.settings.roundLengthMinutes} min
            </div>
            <div>
              <span className="font-medium">Headstart:</span> {room.settings.headstartMinutes} min
            </div>
            <div>
              <span className="font-medium">Max Players:</span> {room.settings.maxPlayers}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">
            Players ({players.length}/{room.settings.maxPlayers})
          </h2>
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.uid}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
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
                  <p className="font-medium">{player.displayName}</p>
                  {player.uid === room.host_uid && (
                    <p className="text-xs text-blue-600">Host</p>
                  )}
                </div>
                {isHost && player.uid !== room.host_uid && (
                  <button
                    onClick={() => handleKickPlayer(player.uid)}
                    disabled={kicking === player.uid}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {kicking === player.uid ? 'Kicking...' : 'Kick'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleLeaveRoom}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Leave Room
          </button>
          
          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart || starting}
              className="flex-1 py-3 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? 'Starting...' : 'Start Game'}
            </button>
          )}
        </div>

        {!canStart && isHost && (
          <p className="text-center text-sm text-gray-600 mt-3">
            Need at least {Math.max(2, room.settings.killerCount + 1)} players to start
          </p>
        )}
      </div>
    </main>
  );
}

export default function RoomPageWrapper({ params }: PageProps) {
  return (
    <AuthGuard fallback={
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <p>Please sign in to access this room.</p>
      </main>
    }>
      <RoomPage params={params} />
    </AuthGuard>
  );
}