'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { uploadProfilePicture, updateUserProfile } from '@/lib/userService';

interface ProfileSetupProps {
  onComplete: () => void;
}

export default function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const { user } = useAuth();
  const [customUsername, setCustomUsername] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg text-black">
      <h2 className="text-2xl font-bold text-center mb-6">Complete Your Profile</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-center">
          <div className="mb-4">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Profile preview"
                className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-gray-200"
              />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto bg-gray-200 flex items-center justify-center border-4 border-gray-200">
                <span className="text-2xl text-gray-500">
                  {user?.displayName?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <label className="block">
            <span className="text-sm text-gray-600">Profile Picture (optional)</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 mt-2"
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Username (optional)
          </label>
          <input
            type="text"
            value={customUsername}
            onChange={(e) => setCustomUsername(e.target.value)}
            placeholder={`Default: ${user?.displayName}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={20}
          />
          <p className="text-xs text-gray-500 mt-1">
            This will be displayed to other players
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Skip
          </button>
          <button
            type="submit"
            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}