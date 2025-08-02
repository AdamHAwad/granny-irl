'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, createUserProfile } from '@/lib/userService';
import { UserProfile } from '@/types/user';

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        console.log('useUserProfile: Loading profile for user:', user.id);
        console.log('useUserProfile: User metadata:', user.user_metadata);
        
        let userProfile = await getUserProfile(user.id);
        console.log('useUserProfile: Existing profile found:', userProfile);
        
        if (!userProfile) {
          console.log('useUserProfile: Creating new profile...');
          userProfile = await createUserProfile({
            id: user.id,
            email: user.email || '',
            user_metadata: user.user_metadata || {},
          });
          console.log('useUserProfile: New profile created:', userProfile);
          setNeedsSetup(true);
        }
        
        setProfile(userProfile);
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      const userProfile = await getUserProfile(user.id);
      setProfile(userProfile);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  return {
    profile,
    loading,
    needsSetup,
    setNeedsSetup,
    refreshProfile,
  };
}