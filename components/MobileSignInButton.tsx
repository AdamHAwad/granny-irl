'use client';

import { mobileService } from '@/lib/mobileService';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function MobileSignInButton() {
  const [loading, setLoading] = useState(false);

  const handleMobileAuth = async () => {
    setLoading(true);
    
    try {
      // Show instructions
      const proceed = confirm(
        '📱 Mobile Authentication\n\n' +
        '1. Click OK to open the web browser\n' +
        '2. Sign in with Google on the website\n' +
        '3. Generate and copy the auth code\n' +
        '4. Return here to enter the code\n\n' +
        'Ready to start?'
      );
      
      if (!proceed) {
        setLoading(false);
        return;
      }
      
      // Open browser
      const url = 'https://granny-irl.vercel.app/?mobile-auth=true';
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank');
      }
      
      // Wait a moment then prompt for code
      setTimeout(() => {
        const authCode = prompt(
          '🔑 Enter Mobile Auth Code\n\n' +
          'Paste the code from the website:'
        );
        
        if (authCode && authCode.trim()) {
          exchangeAuthCode(authCode.trim());
        } else {
          setLoading(false);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Mobile auth error:', error);
      alert('Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  const exchangeAuthCode = async (authCode: string) => {
    try {
      const response = await fetch('https://granny-irl.vercel.app/api/mobile-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authCode }),
      });
      
      if (!response.ok) {
        throw new Error('Invalid auth code');
      }
      
      const { session } = await response.json();
      
      if (session) {
        // Set in Supabase - this will trigger the auth state change
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        
        alert('✅ Successfully signed in!');
        window.location.reload();
      }
      
    } catch (error) {
      alert('❌ Invalid or expired auth code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleMobileAuth}
        disabled={loading}
        className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
      >
        {loading ? '⏳ Processing...' : '📱 Mobile App Sign In'}
      </button>
      
      <p className="text-xs text-gray-500 text-center">
        Use this if the regular sign-in isn&apos;t working
      </p>
    </div>
  );
}