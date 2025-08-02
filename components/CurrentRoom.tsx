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
      case 'waiting': return 'bg-blue-100 text-blue-800';
      case 'headstart': return 'bg-orange-100 text-orange-800';
      case 'active': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return 'Waiting for Players';
      case 'headstart': return 'Headstart Phase';
      case 'active': return 'Game Active';
      default: return status;
    }
  };

  return (
    <div className="w-full max-w-md mb-6">
      <h2 className="text-lg font-semibold mb-3 text-gray-800">Your Current Games</h2>
      <div className="space-y-2">
        {currentRooms.map((room) => (
          <div
            key={room.id}
            onClick={() => handleRoomClick(room)}
            className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 shadow-sm"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Room {room.id}</h3>
                <p className="text-sm text-gray-600">
                  {Object.keys(room.players).length}/{room.settings.maxPlayers} players
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                {getStatusText(room.status)}
              </span>
            </div>
            
            <div className="text-xs text-gray-500 grid grid-cols-3 gap-2">
              <span>🔪 {room.settings.killerCount} killer{room.settings.killerCount > 1 ? 's' : ''}</span>
              <span>⏱️ {room.settings.roundLengthMinutes}m round</span>
              <span>⏰ {room.settings.headstartMinutes}m start</span>
            </div>
            
            {room.status !== 'waiting' && (
              <div className="mt-2 text-xs text-gray-600">
                Click to rejoin the game →
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}