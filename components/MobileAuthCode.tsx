'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function MobileAuthCode() {
  const { session } = useAuth();
  const [authCode, setAuthCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showMobileAuth, setShowMobileAuth] = useState(false);

  // Check if this is a mobile auth request
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mobile-auth') === 'true') {
      setShowMobileAuth(true);
    }
  }, []);

  const generateAuthCode = async () => {
    if (!session?.access_token) {
      setError('No valid session found');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/mobile-auth', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate auth code');
      }

      const data = await response.json();
      setAuthCode(data.authCode);
      
    } catch (error) {
      console.error('Error generating auth code:', error);
      setError('Failed to generate auth code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyAuthCode = async () => {
    try {
      await navigator.clipboard.writeText(authCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = authCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show mobile auth instructions if coming from mobile app
  if (showMobileAuth) {
    return (
      <div className="glass-card p-6 mb-6 max-w-lg w-full animate-slide-up">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📱</div>
          <h2 className="text-xl font-bold text-granny-text mb-2">Mobile Authentication</h2>
          <p className="text-granny-text/80 text-sm">
            Complete your mobile app authentication by following these steps:
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-granny-surface/50 p-4 rounded-lg">
            <h3 className="font-semibold text-granny-text mb-2">📝 Instructions:</h3>
            <ol className="text-sm text-granny-text/90 space-y-2">
              <li>1. Generate your mobile auth code below</li>
              <li>2. Copy the code</li>
              <li>3. Return to your mobile app</li>
              <li>4. Paste the code when prompted</li>
            </ol>
          </div>

          {!authCode ? (
            <button
              onClick={generateAuthCode}
              disabled={loading}
              className="w-full px-6 py-3 bg-granny-danger text-white font-semibold rounded-lg shadow-lg hover:bg-granny-danger/90 transition-all disabled:opacity-50"
            >
              {loading ? '⏳ Generating...' : '🔑 Generate Mobile Auth Code'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-granny-surface/30 p-4 rounded-lg border border-granny-border">
                <p className="text-sm text-granny-text/80 mb-2">Your Mobile Auth Code:</p>
                <div className="font-mono text-lg font-bold text-granny-danger bg-white/10 p-3 rounded border text-center">
                  {authCode}
                </div>
              </div>
              
              <button
                onClick={copyAuthCode}
                className={`w-full px-4 py-2 font-medium rounded-lg transition-all ${
                  copied 
                    ? 'bg-granny-success text-white' 
                    : 'bg-granny-surface text-granny-text hover:bg-granny-surface/80'
                }`}
              >
                {copied ? '✅ Copied!' : '📋 Copy Auth Code'}
              </button>
              
              <div className="text-xs text-granny-text/60 text-center">
                ⚠️ Code expires in 10 minutes
              </div>
            </div>
          )}

          {error && (
            <div className="bg-granny-danger/20 border border-granny-danger/30 p-3 rounded-lg">
              <p className="text-granny-danger text-sm">❌ {error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Regular profile view - show mobile auth option
  return (
    <details className="glass-card p-4 mb-6 max-w-lg w-full">
      <summary className="cursor-pointer font-medium text-granny-text hover:text-granny-danger transition-colors">
        📱 Mobile App Authentication
      </summary>
      
      <div className="mt-4 space-y-3">
        <p className="text-sm text-granny-text/80">
          Need to sign in on the mobile app? Generate an auth code to transfer your session.
        </p>
        
        {!authCode ? (
          <button
            onClick={generateAuthCode}
            disabled={loading}
            className="px-4 py-2 bg-granny-danger text-white font-medium rounded-lg hover:bg-granny-danger/90 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? 'Generating...' : 'Generate Auth Code'}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="bg-granny-surface/30 p-3 rounded border">
              <p className="text-xs text-granny-text/60 mb-1">Auth Code:</p>
              <code className="text-sm font-mono text-granny-danger">{authCode}</code>
            </div>
            <button
              onClick={copyAuthCode}
              className={`text-sm px-3 py-1 rounded transition-all ${
                copied 
                  ? 'bg-granny-success text-white' 
                  : 'bg-granny-surface text-granny-text hover:bg-granny-surface/80'
              }`}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {error && (
          <p className="text-granny-danger text-sm">❌ {error}</p>
        )}
      </div>
    </details>
  );
}