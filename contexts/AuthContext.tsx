'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { mobileService } from '@/lib/mobileService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Handle OAuth callbacks and app state changes on mobile
    if (mobileService.isMobile()) {
      // Listen for app returning to foreground (user might have signed in via browser)
      mobileService.onAppStateChange(async (isActive) => {
        if (isActive) {
          console.log('📱 App became active, checking auth state...');
          // Check if user is now authenticated after returning from browser
          const { data: { session } } = await supabase.auth.getSession();
          if (session && !user) {
            console.log('✅ Found new session after app resumed from background');
            setSession(session);
            setUser(session.user);
            alert('🎉 Authentication successful! Welcome back to Granny IRL.');
          } else if (isActive && !session && !user) {
            console.log('⚠️ App resumed but no session found');
          }
        }
      });

      // Handle deep link callbacks (custom URL scheme) - Enhanced for OAuth
      mobileService.onUrlChange(async (url) => {
        console.log('🔗 Deep link received:', url);
        
        if (url.includes('oauth') || url.includes('com.grannyirl.app')) {
          console.log('✅ OAuth deep link detected, processing authentication...');
          
          // Add a small delay to ensure the app is fully active
          setTimeout(async () => {
            try {
              console.log('🔄 Processing deep link authentication...');
              
              // Method 1: Try to extract tokens from URL
              const fragment = url.split('#')[1] || url.split('?')[1] || '';
              if (fragment) {
                const urlParams = new URLSearchParams(fragment);
                console.log('📋 URL fragment found:', fragment);
                
                const accessToken = urlParams.get('access_token');
                const refreshToken = urlParams.get('refresh_token');
                
                if (accessToken) {
                  console.log('🔑 Found access token in deep link, establishing session...');
                  
                  const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || '',
                  });
                  
                  if (!error && data.session) {
                    console.log('✅ Session established from deep link tokens');
                    setSession(data.session);
                    setUser(data.session.user);
                    alert('🎉 Successfully signed in via Chrome! Welcome to Granny IRL.');
                    return;
                  }
                }
              }
              
              // Method 2: Check if Supabase automatically handled the session
              console.log('🔍 No tokens in URL, checking for established session...');
              const { data: { session }, error } = await supabase.auth.getSession();
              
              if (session && !user) {
                console.log('✅ Found established session after deep link');
                setSession(session);
                setUser(session.user);
                alert('🎉 Successfully signed in! Welcome to Granny IRL.');
                return;
              }
              
              // Method 3: Try to refresh session in case it's there but not detected
              console.log('🔄 Attempting session refresh...');
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
              
              if (refreshData.session && !refreshError) {
                console.log('✅ Session refreshed successfully');
                setSession(refreshData.session);
                setUser(refreshData.session.user);
                alert('🎉 Successfully signed in! Welcome to Granny IRL.');
                return;
              }
              
              // If we get here, authentication didn't work
              console.error('❌ No valid session found after deep link processing');
              alert('⚠️ Returned from Chrome but authentication incomplete. Please try signing in again.');
              
            } catch (error) {
              console.error('❌ Error processing OAuth deep link:', error);
              alert('⚠️ Error processing authentication. Please try again.');
            }
          }, 500); // 500ms delay to ensure app is active
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      if (mobileService.isMobile()) {
        mobileService.removeAllListeners();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log('signInWithGoogle called');
      console.log('NODE_ENV:', process.env.NODE_ENV);
      console.log('Is Mobile App:', mobileService.isMobile());
      console.log('Window location:', window.location.href);
      console.log('User agent:', navigator.userAgent);
      
      // Check if running in Capacitor app by multiple methods
      const urlParams = new URLSearchParams(window.location.search);
      const hasCapacitorParam = urlParams.get('capacitor') === 'true';
      const isCapacitorApp = hasCapacitorParam || 
                            navigator.userAgent.includes('GrannyIRLApp') || 
                            (window as any).Capacitor !== undefined ||
                            mobileService.isMobile();
      
      console.log('Is Capacitor App:', isCapacitorApp);
      console.log('Has capacitor param:', hasCapacitorParam);
      console.log('Capacitor object:', (window as any).Capacitor);
      
      if (isCapacitorApp) {
        console.log('📱 Mobile Auth: Using manual session transfer method');
        
        // Show instructions for manual authentication
        const proceed = confirm(
          '🔐 Mobile Authentication Required\n\n' +
          'Due to Google\'s mobile restrictions, please:\n\n' +
          '1. Open https://granny-irl.vercel.app in your browser\n' +
          '2. Sign in with Google there\n' +
          '3. Go to your profile and copy the "Mobile Auth Code"\n' +
          '4. Return here and enter the code\n\n' +
          'Click OK to get your auth code, or Cancel to try guest mode.'
        );
        
        if (proceed) {
          // Open web app in system browser for authentication
          await mobileService.openInSystemBrowser('https://granny-irl.vercel.app/?mobile-auth=true');
          
          // Show input dialog for auth code
          setTimeout(() => {
            const authCode = prompt(
              '🔑 Enter Mobile Auth Code\n\n' +
              'After signing in on the web:\n' +
              '1. Click your profile picture\n' +
              '2. Copy the "Mobile Auth Code"\n' +
              '3. Paste it below:'
            );
            
            if (authCode && authCode.trim()) {
              exchangeAuthCode(authCode.trim());
            } else {
              alert('❌ No auth code entered. You can try again later or use guest mode.');
            }
          }, 2000);
          
        } else {
          // Offer guest mode
          const useGuest = confirm(
            '🎮 Guest Mode Available\n\n' +
            'You can play as a guest without signing in.\n' +
            'Your progress won\'t be saved, but you can join games immediately.\n\n' +
            'Use Guest Mode?'
          );
          
          if (useGuest) {
            signInAsGuest();
          }
        }
      } else {
        // Standard web flow
        const redirectUrl = process.env.NODE_ENV === 'production' 
          ? 'https://granny-irl.vercel.app/' 
          : `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
        
        if (error) {
          console.error('Web OAuth error:', error);
        }
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Helper function to exchange auth code for session
  const exchangeAuthCode = async (authCode: string) => {
    try {
      console.log('🔄 Exchanging auth code for session...');
      
      // Call a serverless function to exchange the code
      const response = await fetch('https://granny-irl.vercel.app/api/mobile-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authCode }),
      });
      
      if (!response.ok) {
        throw new Error('Auth code exchange failed');
      }
      
      const { session } = await response.json();
      
      if (session) {
        console.log('✅ Session received from auth code');
        setSession(session);
        setUser(session.user);
        alert('🎉 Successfully authenticated! Welcome to Granny IRL.');
      } else {
        throw new Error('No session in response');
      }
      
    } catch (error) {
      console.error('❌ Auth code exchange failed:', error);
      alert('❌ Invalid or expired auth code. Please try again.');
    }
  };

  // Helper function for guest mode
  const signInAsGuest = async () => {
    try {
      console.log('🎮 Signing in as guest...');
      
      // Create anonymous session
      const { data, error } = await supabase.auth.signInAnonymously();
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Guest session created');
      setSession(data.session);
      setUser(data.user);
      
      alert('🎮 Signed in as Guest! You can play games but progress won\'t be saved.');
      
    } catch (error) {
      console.error('❌ Guest sign-in failed:', error);
      alert('❌ Guest mode failed. Please check your internet connection.');
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}