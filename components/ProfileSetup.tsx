'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadProfilePicture, updateUserProfile, deleteProfilePicture } from '@/lib/userService';
import { UserProfile } from '@/types/user';

interface ProfileSetupProps {
  onComplete: () => void;
  existingProfile?: UserProfile | null;
}

export default function ProfileSetup({ onComplete, existingProfile }: ProfileSetupProps) {
  const { user } = useAuth();
  const [customUsername, setCustomUsername] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load existing profile data when component mounts
  useEffect(() => {
    if (existingProfile) {
      setCustomUsername(existingProfile.custom_username || '');
      if (existingProfile.profile_picture_url) {
        setPreviewUrl(existingProfile.profile_picture_url);
      }
    }
  }, [existingProfile]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      console.log('ProfileSetup: Starting profile update for user:', user.id);
      
      if (profileImage) {
        console.log('ProfileSetup: Uploading profile picture...');
        await uploadProfilePicture(user.id, profileImage);
        console.log('ProfileSetup: Profile picture uploaded successfully');
      }

      if (customUsername.trim()) {
        console.log('ProfileSetup: Updating username to:', customUsername.trim());
        await updateUserProfile(user.id, { custom_username: customUsername.trim() });
        console.log('ProfileSetup: Username updated successfully');
      }

      console.log('ProfileSetup: Profile setup completed successfully');
      onComplete();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(`Error updating profile: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleRemoveImage = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await deleteProfilePicture(user.id);
      setProfileImage(null);
      setPreviewUrl(null);
      console.log('Profile picture removed successfully');
    } catch (error) {
      console.error('Error removing profile picture:', error);
      alert(`Error removing profile picture: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-modal max-w-md w-full text-granny-text animate-slide-up">
        <div className="p-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-granny-text mb-2 flex items-center justify-center gap-2">
              👤 Complete Your Profile
            </h2>
            <p className="text-sm text-granny-text-muted">
              Customize your identity for the hunt
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center">
              <div className="mb-6">
                {previewUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={previewUrl}
                      alt="Profile preview"
                      className="w-28 h-28 rounded-full mx-auto object-cover border-4 border-granny-survivor/50 shadow-lg"
                    />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-transparent to-granny-bg/20 pointer-events-none" />
                  </div>
                ) : (
                  <div className="w-28 h-28 rounded-full mx-auto bg-granny-surface border-4 border-granny-border/50 flex items-center justify-center shadow-lg">
                    <span className="text-3xl text-granny-text-muted font-bold">
                      {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-semibold text-granny-text mb-3 block flex items-center gap-2 justify-center">
                    📸 Profile Picture (optional)
                  </span>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="block w-full text-sm text-granny-text-muted file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-granny-surface file:text-granny-text file:border file:border-granny-border hover:file:bg-granny-surface-light file:transition-all file:duration-200 bg-granny-surface border border-granny-border rounded-lg focus:border-granny-survivor/50 focus:ring-2 focus:ring-granny-survivor/20 transition-all duration-200"
                      disabled={loading}
                    />
                  </div>
                </label>
                {(previewUrl || profileImage) && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={loading}
                    className="text-sm text-granny-error hover:text-granny-error/80 font-medium disabled:opacity-50 transition-colors duration-200 flex items-center gap-1 mx-auto"
                  >
                    🗑️ Remove Picture
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-granny-text mb-3 flex items-center gap-2">
                ✏️ Custom Username (optional)
              </label>
              <input
                type="text"
                value={customUsername}
                onChange={(e) => setCustomUsername(e.target.value)}
                placeholder={`Default: ${user?.user_metadata?.full_name || user?.email}`}
                className="input-field w-full placeholder:text-granny-text-muted/60"
                maxLength={20}
              />
              <p className="text-xs text-granny-text-muted mt-3 flex items-center gap-1">
                👥 This will be displayed to other players during games
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={handleSkip}
                className="btn-ghost flex-1 py-3"
                disabled={loading}
              >
                Skip for Now
              </button>
              <button
                type="submit"
                className="btn-secondary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  <>💾 Save Profile</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}