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
  loggingOut: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

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
          
          // Add small delay to ensure Safari has completed the redirect
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if user is now authenticated after returning from browser
          const { data: { session: newSession } } = await supabase.auth.getSession();
          console.log('📱 Session check result:', newSession ? 'Found session' : 'No session');
          
          if (newSession && (!user || user.id !== newSession.user.id)) {
            console.log('✅ Found new/different session after app resumed from background');
            setSession(newSession);
            setUser(newSession.user);
          } else if (!newSession && !user) {
            console.log('⚠️ App resumed but no session found');
          }
          
          // Also check for auth state change events
          supabase.auth.onAuthStateChange((event, session) => {
            console.log('📱 Auth state change during app resume:', event, session ? 'has session' : 'no session');
            if (session && event === 'SIGNED_IN') {
              setSession(session);
              setUser(session.user);
            }
          });
          
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
        
        try {
          // Try direct OAuth without skipBrowserRedirect first
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: redirectUrl,
              // Don't skip browser redirect - let Supabase handle it
            },
          });
          
          if (error) {
            console.error('OAuth error:', error);
            // Fallback to manual URL approach
            console.log('📱 Fallback: Getting OAuth URL manually...');
            
            const { data: urlData, error: urlError } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
              },
            });
            
            if (urlError || !urlData?.url) {
              console.error('Failed to get OAuth URL:', urlError);
              alert('Failed to start authentication. Please try again.');
              return;
            }
            
            console.log('Opening OAuth URL in system browser:', urlData.url);
            await mobileService.openInSystemBrowser(urlData.url);
          }
        } catch (browserError) {
          console.error('Browser OAuth failed:', browserError);
          alert('Failed to open authentication browser. Please try again.');
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

  const signInWithApple = async () => {
    try {
      console.log('signInWithApple called');

      const isCapacitorApp =
        mobileService.isMobile() ||
        (window as any).Capacitor !== undefined ||
        window.location.href.includes('capacitor=true');

      if (isCapacitorApp) {
        console.log('📱 Mobile OAuth (Apple): Using custom URL scheme for seamless auth');

        const redirectUrl = 'com.prowl.app://oauth';

        try {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'apple',
            options: {
              redirectTo: redirectUrl,
            },
          });

          if (error) {
            console.error('Apple OAuth error:', error);
            console.log('📱 Fallback (Apple): Getting OAuth URL manually...');

            const { data: urlData, error: urlError } = await supabase.auth.signInWithOAuth({
              provider: 'apple',
              options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
              },
            });

            if (urlError || !urlData?.url) {
              console.error('Failed to get Apple OAuth URL:', urlError);
              alert('Failed to start Apple sign-in. Please try again.');
              return;
            }

            console.log('Opening Apple OAuth URL in system browser:', urlData.url);
            await mobileService.openInSystemBrowser(urlData.url);
          }
        } catch (browserError) {
          console.error('Browser Apple OAuth failed:', browserError);
          alert('Failed to open Apple authentication browser. Please try again.');
        }
      } else {
        const redirectUrl =
          process.env.NODE_ENV === 'production'
            ? 'https://granny-irl.vercel.app/'
            : `${window.location.origin}/`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: redirectUrl,
          },
        });

        if (error) {
          console.error('Web Apple OAuth error:', error);
        }
      }
    } catch (error) {
      console.error('Error signing in with Apple:', error);
    }
  };

  const logout = async () => {
    if (loggingOut) {
      console.log('⚠️ Logout already in progress, ignoring duplicate request');
      return;
    }

    try {
      console.log('🔄 Starting logout process...');
      setLoggingOut(true);

      // Create timeout promise for responsiveness
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Logout timeout')), 10000)
      );

      // Create logout promise
      const logoutPromise = supabase.auth.signOut();

      // Race between logout and timeout
      const result = await Promise.race([logoutPromise, timeoutPromise]) as { error: any };
      
      if (result.error) {
        console.error('❌ Supabase logout error:', result.error);
        throw result.error;
      }

      console.log('✅ Logout successful via Supabase');

    } catch (error) {
      console.error('❌ Logout error, attempting force logout:', error);
      
      // Force logout by clearing local state and storage
      try {
        // Clear Supabase session storage
        await supabase.auth.signOut({ scope: 'local' });
        
        // Clear local storage items that might contain auth data
        if (typeof window !== 'undefined') {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('supabase') || key.includes('auth'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        }

        // Manually clear state
        setUser(null);
        setSession(null);
        
        console.log('✅ Force logout completed');
        
        // On mobile, also try to clear any app state
        if (mobileService.isMobile()) {
          console.log('📱 Clearing mobile app state...');
          // Could add additional mobile cleanup here if needed
        }
        
      } catch (forceError) {
        console.error('❌ Force logout also failed:', forceError);
        // Even if force logout fails, clear the UI state
        setUser(null);
        setSession(null);
      }
    } finally {
      setLoggingOut(false);
      console.log('🏁 Logout process completed');
    }
  };


  const value = {
    user,
    session,
    loading,
    loggingOut,
    signInWithGoogle,
    signInWithApple,
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