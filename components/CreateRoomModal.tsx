'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { createRoom } from '@/lib/gameService';
import { RoomSettings } from '@/types/game';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (roomCode: string) => void;
}

export default function CreateRoomModal({
  isOpen,
  onClose,
  onRoomCreated,
}: CreateRoomModalProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<RoomSettings>({
    killerCount: 1,
    roundLengthMinutes: 15,
    headstartMinutes: 3,
    maxPlayers: 15,
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setLoading(true);
    try {
      console.log('CreateRoom: Starting room creation for user:', user.id);
      console.log('CreateRoom: Profile data:', profile);
      
      const finalSettings: RoomSettings = {
        ...settings
      };
      
      console.log('CreateRoom: Settings:', finalSettings);
      
      const roomCode = await createRoom(
        user.id,
        {
          displayName: profile.custom_username || profile.display_name,
          profilePictureUrl: profile.profile_picture_url,
        },
        finalSettings
      );
      
      console.log('CreateRoom: Room created successfully with code:', roomCode);
      onRoomCreated(roomCode);
    } catch (error: any) {
      console.error('Error creating room:', error);
      console.error('Error details:', error);
      const errorMessage = error?.message || 'Failed to create room. Please try again.';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md text-black">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Create Room</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Killers
            </label>
            <select
              value={settings.killerCount}
              onChange={(e) =>
                setSettings({ ...settings, killerCount: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 Killer</option>
              <option value={2}>2 Killers</option>
              <option value={3}>3 Killers</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Round Length
            </label>
            <select
              value={settings.roundLengthMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  roundLengthMinutes: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0.5}>30 seconds (testing)</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Headstart Time
            </label>
            <select
              value={settings.headstartMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  headstartMinutes: parseFloat(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0.083}>5 seconds (testing)</option>
              <option value={1}>1 minute</option>
              <option value={3}>3 minutes</option>
              <option value={5}>5 minutes</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Time for survivors to hide before the round starts
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Players
            </label>
            <select
              value={settings.maxPlayers}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maxPlayers: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5 players</option>
              <option value={8}>8 players</option>
              <option value={10}>10 players</option>
              <option value={12}>12 players</option>
              <option value={15}>15 players</option>
            </select>
          </div>


          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}