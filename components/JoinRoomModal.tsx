'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { joinRoom } from '@/lib/gameService';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomJoined: (roomCode: string) => void;
}

export default function JoinRoomModal({
  isOpen,
  onClose,
  onRoomJoined,
}: JoinRoomModalProps) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Room code must be 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const room = await joinRoom(
        code,
        user.id,
        {
          displayName: profile.custom_username || profile.display_name,
          profilePictureUrl: profile.profile_picture_url,
        }
      );

      if (!room) {
        setError('Room not found');
        return;
      }

      onRoomJoined(code);
    } catch (error: any) {
      setError(error.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 6);
    setRoomCode(value);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-modal p-8 w-full max-w-md text-prowl-text animate-slide-up">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-prowl-text mb-1">🚪 Join Room</h2>
            <p className="text-sm text-prowl-text-muted">Enter the 6-digit room code</p>
          </div>
          <button
            onClick={onClose}
            className="text-prowl-text-muted hover:text-prowl-text text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-prowl-surface-light transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-prowl-text mb-4 flex items-center gap-2">
              🔑 Room Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={roomCode}
                onChange={handleInputChange}
                placeholder="ABC123"
                className="w-full px-6 py-4 bg-prowl-surface border-2 border-prowl-border text-prowl-text placeholder-prowl-text-muted rounded-xl focus:outline-none focus:border-prowl-survivor/50 focus:ring-2 focus:ring-prowl-survivor/20 text-center text-3xl font-mono tracking-[0.3em] font-bold transition-all duration-200"
                maxLength={6}
                autoComplete="off"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-prowl-survivor/5 to-transparent pointer-events-none rounded-xl" />
            </div>
            <p className="text-sm text-prowl-text-muted mt-3 text-center">
              Ask the host for the room code to join the hunt
            </p>
          </div>

          {error && (
            <div className="glass-card p-4 border border-prowl-error/30 bg-prowl-error/10">
              <p className="text-prowl-error text-sm font-medium flex items-center gap-2">
                ⚠️ {error}
              </p>
            </div>
          )}

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1 py-3"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-secondary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || roomCode.length !== 6}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Joining...</span>
                </div>
              ) : (
                <>🚪 Join Room</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}