'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserRooms } from '@/lib/gameService';
import { Room } from '@/types/game';

export default function CurrentRoom() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentRooms, setCurrentRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchCurrentRooms = async () => {
      try {
        const rooms = await getCurrentUserRooms(user.id);
        setCurrentRooms(rooms);
      } catch (error) {
        console.error('Error fetching current rooms:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentRooms();
    
    // Refresh every 5 seconds to catch room updates
    const interval = setInterval(fetchCurrentRooms, 5000);
    
    return () => clearInterval(interval);
  }, [user]);

  if (loading || !user || currentRooms.length === 0) {
    return null;
  }

  const handleRoomClick = (room: Room) => {
    if (room.status === 'waiting') {
      router.push(`/room/${room.id}`);
    } else if (room.status === 'headstart' || room.status === 'active') {
      router.push(`/game/${room.id}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-prowl-survivor/20 text-prowl-survivor border border-prowl-survivor/50';
      case 'headstart': return 'bg-prowl-warning/20 text-prowl-warning border border-prowl-warning/50';
      case 'active': return 'bg-prowl-danger/20 text-prowl-danger border border-prowl-danger/50';
      default: return 'bg-prowl-surface text-prowl-text-muted border border-prowl-border/50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return '⏳ Waiting for Players';
      case 'headstart': return '🏃 Headstart Phase';
      case 'active': return '🔥 Game Active';
      default: return status;
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'waiting': return '🏠';
      case 'headstart': return '⚡';
      case 'active': return '💀';
      default: return '🎮';
    }
  };

  return (
    <div className="w-full max-w-md mb-6">
      <h2 className="text-lg font-semibold mb-4 text-prowl-text flex items-center gap-2">
        🎮 Your Active Games
      </h2>
      <div className="space-y-3">
        {currentRooms.map((room) => (
          <div
            key={room.id}
            onClick={() => handleRoomClick(room)}
            className="glass-card border border-prowl-border/30 hover:border-prowl-border/50 p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] group"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-lg text-prowl-text flex items-center gap-2 group-hover:text-prowl-survivor transition-colors">
                  {getStatusEmoji(room.status)} Room {room.id}
                </h3>
                <p className="text-sm text-prowl-text-muted flex items-center gap-1">
                  👥 {Object.keys(room.players).length}/{room.settings.maxPlayers} players
                </p>
              </div>
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(room.status)} animate-pulse`}>
                {getStatusText(room.status)}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-xs text-prowl-text-muted mb-2">
              <div className="flex items-center gap-1">
                <span className="text-prowl-danger">🔪</span>
                <span>{room.settings.killerCount} killer{room.settings.killerCount > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-prowl-warning">⏱️</span>
                <span>{room.settings.roundLengthMinutes}m round</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-prowl-survivor">🏃</span>
                <span>{room.settings.headstartMinutes}m start</span>
              </div>
            </div>
            
            {room.status !== 'waiting' && (
              <div className="mt-3 pt-3 border-t border-prowl-border/20">
                <div className="text-xs text-prowl-warning font-medium flex items-center gap-1 animate-pulse">
                  ⚡ Click to rejoin the hunt →
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}