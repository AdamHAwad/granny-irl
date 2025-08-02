'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import SignInButton from '@/components/SignInButton';
import AuthGuard from '@/components/AuthGuard';
import ProfileSetup from '@/components/ProfileSetup';
import CreateRoomModal from '@/components/CreateRoomModal';
import JoinRoomModal from '@/components/JoinRoomModal';
import CurrentRoom from '@/components/CurrentRoom';

function AuthenticatedHome() {
  const { user, logout } = useAuth();
  const { profile, loading, needsSetup, setNeedsSetup, refreshProfile } = useUserProfile();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

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