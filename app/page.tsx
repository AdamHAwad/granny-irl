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
import SignInWithAppleButton from '@/components/SignInWithAppleButton';
import AuthGuard from '@/components/AuthGuard';
import ProfileSetup from '@/components/ProfileSetup';
import CreateRoomModal from '@/components/CreateRoomModal';
import JoinRoomModal from '@/components/JoinRoomModal';
import CurrentRoom from '@/components/CurrentRoom';
import LocationPermissionModal from '@/components/LocationPermissionModal';
import { locationService } from '@/lib/locationService';

function AuthenticatedHome() {
  const { user, logout, loggingOut } = useAuth();
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
      <main className="flex min-h-screen flex-col items-center justify-center native-full-width">
        <div className="glass-card-mobile p-6 text-center max-w-sm w-full mx-auto">
          <div className="text-lg text-prowl-text mb-4">Loading profile...</div>
          <div className="w-8 h-8 border-2 border-prowl-danger border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </main>
    );
  }

  if (needsSetup) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center native-full-width">
        <div className="glass-modal p-6 max-w-md w-full mx-auto animate-slide-up-mobile">
          <ProfileSetup
            existingProfile={profile}
            onComplete={() => {
              setNeedsSetup(false);
              refreshProfile();
            }}
          />
        </div>
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
      <main className="flex min-h-screen flex-col items-center justify-center native-full-width relative">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-prowl-bg/80 to-prowl-bg" />
        
        <div className="glass-card-mobile p-6 text-center mb-6 max-w-lg w-full mx-auto animate-slide-up-mobile relative z-10">
          <div className="mb-6">
            {profile?.profile_picture_url ? (
              <img
                src={profile.profile_picture_url}
                alt="Profile"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto object-cover border-2 border-prowl-border shadow-xl"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto bg-prowl-surface flex items-center justify-center border-2 border-prowl-border shadow-xl">
                <span className="text-2xl sm:text-3xl text-prowl-text font-semibold">
                  {displayName?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <h1 className="heading-mobile mb-3 text-prowl-text">
            Prowl
          </h1>
          <div className="w-12 h-1 bg-gradient-to-r from-prowl-danger to-prowl-survivor mx-auto mb-4 rounded-full shadow-sm" />
          <p className="subheading-mobile mb-6 text-prowl-text">
            Welcome back, <span className="text-prowl-danger font-semibold">{displayName}</span>!
          </p>
          
          {/* Location status indicator */}
          {locationPermissionChecked && (
            <div className={`mb-6 px-4 py-3 rounded-lg text-sm glass-card ${
              hasLocationPermission 
                ? 'border-prowl-success/30' 
                : 'border-prowl-warning/30'
            }`}>
              {hasLocationPermission ? (
                <div className="flex items-center justify-center space-x-2 text-prowl-success">
                  <span>📍</span>
                  <span className="font-medium">Location enabled - ready for enhanced gameplay!</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2 text-prowl-warning">
                  <span>📍</span>
                  <span>
                    Location disabled - 
                    <button 
                      onClick={() => setShowLocationModal(true)}
                      className="underline hover:no-underline font-semibold ml-1"
                    >
                      click to enable
                    </button> for enhanced features
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <button
              onClick={() => setNeedsSetup(true)}
              className="text-prowl-danger hover:text-prowl-danger/80 underline hover:no-underline transition-all font-medium"
            >
              Edit Profile
            </button>
            <button
              onClick={() => router.push('/history')}
              className="text-prowl-survivor hover:text-prowl-survivor/80 underline hover:no-underline transition-all font-medium"
            >
              Game History
            </button>
            <button
              onClick={logout}
              disabled={loggingOut}
              className={`underline hover:no-underline transition-all font-medium flex items-center space-x-1 ${
                loggingOut 
                  ? 'text-prowl-text-muted/50 cursor-not-allowed' 
                  : 'text-prowl-text-muted hover:text-prowl-text'
              }`}
            >
              {loggingOut ? (
                <>
                  <div className="w-3 h-3 border border-prowl-text-muted border-t-transparent rounded-full animate-spin" />
                  <span>Signing out...</span>
                </>
              ) : (
                <span>Sign out</span>
              )}
            </button>
          </div>
        </div>

        <div className="w-full max-w-lg mb-8">
          <CurrentRoom />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg relative z-10">
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary btn-mobile flex-1 text-lg font-semibold animate-glow"
          >
            🎮 Create Room
          </button>
          <button
            onClick={() => setShowJoinModal(true)}
            className="btn-secondary btn-mobile flex-1 text-lg font-semibold"
          >
            🚪 Join Room
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
    <main className="flex min-h-screen flex-col items-center justify-center native-full-width relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-prowl-bg/50 to-prowl-bg" />
      
      <div className="glass-card-mobile p-6 text-center max-w-md w-full mx-auto animate-slide-up-mobile relative z-10">
        <div className="mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-prowl-text bg-gradient-to-r from-prowl-danger to-prowl-survivor bg-clip-text text-transparent animate-float">
            Prowl
          </h1>
          <div className="w-16 h-1 bg-gradient-to-r from-prowl-danger to-prowl-survivor mx-auto mb-6 rounded-full shadow-sm" />
        </div>
        
        <p className="subheading-mobile mb-4 text-prowl-text">Real-life horror tag</p>
        <p className="text-prowl-text-muted mb-8 leading-relaxed text-sm sm:text-base">
          Outdoor multiplayer game with GPS tracking, skillchecks, and escape mechanics
        </p>
        
        <div className="space-y-3">
          <SignInButton />
          <SignInWithAppleButton />
          <p className="text-sm text-prowl-text-muted">
            Sign in with Google or Apple to start playing
          </p>
        </div>
      </div>
      
      {/* Floating elements for atmosphere - positioned safely away from edges */}
      <div className="absolute top-24 left-8 w-2 h-2 bg-prowl-danger/30 rounded-full animate-pulse hidden sm:block" />
      <div className="absolute bottom-40 right-8 w-3 h-3 bg-prowl-survivor/20 rounded-full animate-pulse delay-1000 hidden sm:block" />
      <div className="absolute top-1/3 right-12 w-1 h-1 bg-prowl-warning/40 rounded-full animate-pulse delay-500 hidden sm:block" />
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