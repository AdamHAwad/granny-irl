'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { mobileService } from '@/lib/mobileService';
import { permissionManager } from '@/lib/permissionManager';

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

    // Request permissions on initial app load (web and mobile)
    const requestInitialPermissions = async () => {
      try {
        console.log('🚀 Requesting permissions on app startup...');
        const permissionResult = await permissionManager.requestPermissionsOnStartup();
        console.log('🚀 Initial permission request result:', permissionResult.success ? '✅ Success' : '❌ Some failed', permissionResult.permissions);
      } catch (error) {
        console.error('🚀 Error requesting permissions on app startup:', error);
      }
    };

    // Request permissions after a short delay to avoid overwhelming the user
    setTimeout(requestInitialPermissions, 2000);

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
          } else if (isActive && !session && !user) {
            console.log('⚠️ App resumed but no session found');
          }
          
          // Request permissions when app becomes active (if not already done)
          try {
            console.log('📱 Requesting permissions on app resume...');
            const permissionResult = await permissionManager.requestPermissionsOnStartup();
            console.log('📱 Permission request result:', permissionResult.success ? '✅ Success' : '❌ Some failed', permissionResult.permissions);
          } catch (error) {
            console.error('📱 Error requesting permissions on app resume:', error);
          }
        }
      });

      // Track if we've already processed an auth callback
      let authProcessed = false;
      
      // Handle deep link callbacks (custom URL scheme) for OAuth
      mobileService.onUrlChange(async (url) => {
        console.log('🔗 Deep link received:', url);
        
        if (url.includes('oauth') || url.includes('com.prowl.app')) {
          // Prevent processing the same auth callback multiple times
          if (authProcessed) {
            console.log('⚠️ Auth already processed, skipping duplicate callback');
            return;
          }
          
          console.log('✅ OAuth deep link detected');
          authProcessed = true;
          
          try {
            // The URL might look like: com.prowl.app://oauth#access_token=...&refresh_token=...
            // Or it might be: com.prowl.app://oauth?code=...
            
            // Check if it's a code-based OAuth callback
            if (url.includes('code=')) {
              console.log('🔄 OAuth code detected, exchanging for session...');
              
              const urlParams = new URLSearchParams(url.split('?')[1] || '');
              const code = urlParams.get('code');
              
              if (code) {
                // Exchange the code for a session
                const { data, error } = await supabase.auth.exchangeCodeForSession(code);
                
                if (!error && data.session) {
                  console.log('✅ Session established from OAuth code');
                  setSession(data.session);
                  setUser(data.session.user);
                  return;
                }
              }
            }
            
            // Check if it's a token-based callback (from implicit flow)
            const fragment = url.split('#')[1] || '';
            if (fragment) {
              const urlParams = new URLSearchParams(fragment);
              const accessToken = urlParams.get('access_token');
              const refreshToken = urlParams.get('refresh_token');
              
              if (accessToken) {
                console.log('🔑 Found tokens in deep link, establishing session...');
                
                const { data, error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken || '',
                });
                
                if (!error && data.session) {
                  console.log('✅ Session established from tokens');
                  setSession(data.session);
                  setUser(data.session.user);
                  return;
                }
              }
            }
            
            // Fallback: Check if session was already established
            const { data: { session } } = await supabase.auth.getSession();
            if (session && !user) {
              console.log('✅ Found established session');
              setSession(session);
              setUser(session.user);
            }
            
          } catch (error) {
            console.error('❌ Error processing OAuth deep link:', error);
          }
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
      
      // Check if running in Capacitor app
      const isCapacitorApp = mobileService.isMobile() || 
                            (window as any).Capacitor !== undefined ||
                            window.location.href.includes('capacitor=true');
      
      if (isCapacitorApp) {
        console.log('📱 Mobile OAuth: Using custom URL scheme for seamless auth');
        
        // Use custom URL scheme for mobile deep linking
        const redirectUrl = 'com.prowl.app://oauth';
        
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true, // Get the URL instead of redirecting
          },
        });
        
        if (error) {
          console.error('OAuth error:', error);
          alert('Failed to start authentication. Please try again.');
          return;
        }
        
        if (data?.url) {
          console.log('Opening OAuth URL in browser:', data.url);
          // Open in system browser using Capacitor Browser plugin
          await mobileService.openInSystemBrowser(data.url);
          // The app will handle the redirect via deep link in the useEffect
        }
      } else {
        // Standard web flow
        const redirectUrl = process.env.NODE_ENV === 'production' 
          ? 'https://prowl-irl.vercel.app/' 
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