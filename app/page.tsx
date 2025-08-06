/**
 * Home Page - Main entry point for Granny IRL
 * 
 * This is the primary landing page that handles:
 * - User authentication (Google OAuth via Supabase)
 * - Profile setup and management
 * - Room creation and joining
 * - Current active rooms display
 * - Game navigation and statistics
 * 
 * App Overview:
 * Granny IRL is a real-life outdoor tag game where players use their phones
 * to coordinate games. Killers hunt survivors using GPS tracking, with
 * Dead by Daylight-inspired mechanics including skillchecks and escape areas.
 * 
 * Key Features:
 * - 6-digit room codes for easy sharing
 * - Real-time GPS tracking during games
 * - Interactive map with OpenStreetMap
 * - Skillcheck minigames with timing challenges
 * - Escape area mechanics with dual win conditions
 * - Game history and player statistics
 * 
 * User Flow:
 * 1. Sign in with Google
 * 2. Set up profile (display name, picture)
 * 3. Create new room or join existing with code
 * 4. Configure game settings (killers, time, skillchecks)
 * 5. Start game and play outdoors with GPS tracking
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import SignInButton from '@/components/SignInButton';
import AuthGuard from '@/components/AuthGuard';
import ProfileSetup from '@/components/ProfileSetup';
import CreateRoomModal from '@/components/CreateRoomModal';
import JoinRoomModal from '@/components/JoinRoomModal';
import CurrentRoom from '@/components/CurrentRoom';
import LocationPermissionModal from '@/components/LocationPermissionModal';
import { locationService } from '@/lib/locationService';

function AuthenticatedHome() {
  const { user, logout } = useAuth();
  const { profile, loading, needsSetup, setNeedsSetup, refreshProfile } = useUserProfile();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationPermissionChecked, setLocationPermissionChecked] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  // Check for location permission when user finishes profile setup
  useEffect(() => {
    if (!loading && !needsSetup && profile && !locationPermissionChecked) {
      checkLocationPermission();
    }
  }, [loading, needsSetup, profile, locationPermissionChecked]);

  const checkLocationPermission = async () => {
    try {
      // Check if location services are supported
      if (!locationService.isSupported()) {
        setLocationPermissionChecked(true);
        return;
      }

      // Try to get current location to check permission status
      await locationService.getCurrentLocation();
      setHasLocationPermission(true);
      setLocationPermissionChecked(true);
    } catch (error) {
      // Permission not granted, show modal
      setShowLocationModal(true);
      setLocationPermissionChecked(true);
    }
  };

  const handleLocationPermissionGranted = () => {
    setHasLocationPermission(true);
    setShowLocationModal(false);
  };

  const handleLocationPermissionDenied = (error: string) => {
    console.log('Location permission denied:', error);
    setShowLocationModal(false);
    // Continue without location - user can enable it later
  };

  const handleLocationPermissionSkip = () => {
    setShowLocationModal(false);
    // Continue without location - user can enable it later
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-lg">Loading profile...</div>
      </main>
    );
  }

  if (needsSetup) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
        <ProfileSetup
          existingProfile={profile}
          onComplete={() => {
            setNeedsSetup(false);
            refreshProfile();
          }}
        />
      </main>
    );
  }

  const displayName = profile?.custom_username || profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const handleRoomCreated = (roomCode: string) => {
    setShowCreateModal(false);
    router.push(`/room/${roomCode}`);
  };

  const handleRoomJoined = (roomCode: string) => {
    setShowJoinModal(false);
    router.push(`/room/${roomCode}`);
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="text-center mb-8">
          <div className="mb-4">
            {profile?.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt="Profile"
                className="w-16 h-16 rounded-full mx-auto object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full mx-auto bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                <span className="text-xl text-gray-500">
                  {displayName?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <h1 className="text-4xl font-bold mb-4">Granny IRL</h1>
          <p className="text-lg mb-4">Welcome, {displayName}!</p>
          
          {/* Location status indicator */}
          {locationPermissionChecked && (
            <div className={`mb-4 px-3 py-2 rounded-lg text-sm ${
              hasLocationPermission 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
            }`}>
              {hasLocationPermission ? (
                <>📍 Location enabled - ready for enhanced gameplay!</>
              ) : (
                <>📍 Location disabled - <button 
                  onClick={() => setShowLocationModal(true)}
                  className="underline hover:no-underline"
                >
                  click to enable
                </button> for enhanced features</>
              )}
            </div>
          )}
          
          <div className="flex gap-4 justify-center text-sm">
            <button
              onClick={() => setNeedsSetup(true)}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Edit Profile
            </button>
            <button
              onClick={() => router.push('/history')}
              className="text-purple-600 hover:text-purple-800 underline"
            >
              Game History
            </button>
            <button
              onClick={logout}
              className="text-gray-600 hover:text-gray-800 underline"
            >
              Sign out
            </button>
          </div>
        </div>

        <CurrentRoom />
        
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Create Room
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Join Room
          </button>
        </div>
      </main>

      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onRoomCreated={handleRoomCreated}
      />

      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onRoomJoined={handleRoomJoined}
      />

      <LocationPermissionModal
        isOpen={showLocationModal}
        onPermissionGranted={handleLocationPermissionGranted}
        onPermissionDenied={handleLocationPermissionDenied}
        onSkip={handleLocationPermissionSkip}
      />
    </>
  );
}

function UnauthenticatedHome() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Granny IRL</h1>
        <p className="text-lg mb-8">Real-life tag game companion app</p>
        <p className="text-gray-600 mb-8">Sign in to create or join games</p>
      </div>
      <SignInButton />
    </main>
  );
}

export default function Home() {
  return (
    <AuthGuard fallback={<UnauthenticatedHome />}>
      <AuthenticatedHome />
    </AuthGuard>
  );
}