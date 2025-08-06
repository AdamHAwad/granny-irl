'use client';

import { useState, useEffect, useCallback } from 'react';
import { locationService, LocationPermissionStatus } from '@/lib/locationService';

interface LocationPermissionModalProps {
  isOpen: boolean;
  onPermissionGranted: () => void;
  onPermissionDenied: (error: string) => void;
  onSkip?: () => void;
}

export default function LocationPermissionModal({
  isOpen,
  onPermissionGranted,
  onPermissionDenied,
  onSkip
}: LocationPermissionModalProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus | null>(null);

  const checkCurrentPermission = useCallback(async () => {
    if (!locationService.isSupported()) {
      setPermissionStatus({
        granted: false,
        denied: true,
        prompt: false,
        error: 'Location services are not supported on this device'
      });
      return;
    }

    // Try to get current location to check permission
    try {
      await locationService.getCurrentLocation();
      setPermissionStatus({ granted: true, denied: false, prompt: false });
      onPermissionGranted();
    } catch (error) {
      // Permission not granted yet
      setPermissionStatus({ granted: false, denied: false, prompt: true });
    }
  }, []);

  useEffect(() => {
    if (isOpen && !permissionStatus) {
      // Check if we already have permission
      checkCurrentPermission();
    }
  }, [isOpen, permissionStatus, checkCurrentPermission]);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    
    try {
      const status = await locationService.requestPermission();
      setPermissionStatus(status);
      
      if (status.granted) {
        onPermissionGranted();
      } else {
        onPermissionDenied(status.error || 'Location permission denied');
      }
    } catch (error) {
      const errorMessage = 'Failed to request location permission';
      setPermissionStatus({
        granted: false,
        denied: true,
        prompt: false,
        error: errorMessage
      });
      onPermissionDenied(errorMessage);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="glass-modal max-w-md w-full text-granny-text animate-slide-up">
        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-granny-text mb-2 flex items-center justify-center gap-2">
              📍 Location Access
            </h2>
            <p className="text-sm text-granny-text-muted">
              Enhanced tracking for the ultimate horror experience
            </p>
          </div>
          
          {permissionStatus?.granted ? (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-granny-success text-lg font-semibold mb-4">Location access granted!</div>
              <p className="text-sm text-granny-text-muted">
                Your location will be shared with other players during the game for real-time hunting.
              </p>
            </div>
          ) : permissionStatus?.denied ? (
            <div className="text-center">
              <div className="text-6xl mb-4">🚫</div>
              <div className="text-granny-error text-lg font-semibold mb-4">Location access denied</div>
              <p className="text-sm text-granny-text-muted mb-6">
                {permissionStatus.error || 'Location permission is required for the enhanced gameplay experience.'}
              </p>
              <div className="glass-card p-4 border border-granny-warning/30 bg-granny-warning/10 mb-6">
                <p className="text-xs text-granny-warning font-medium">
                  🛠️ <strong>To enable location access:</strong>
                </p>
                <div className="text-xs text-granny-text-muted mt-2 space-y-1">
                  <p>1. Click the location icon in your address bar</p>
                  <p>2. Select &quot;Allow&quot; for location permissions</p>
                  <p>3. Refresh the page and try again</p>
                </div>
              </div>
              {onSkip && (
                <button
                  onClick={handleSkip}
                  className="btn-ghost px-6 py-3"
                >
                  Continue Without Location
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <div className="text-center mb-4">
                  <div className="text-4xl mb-3">🎯</div>
                  <p className="text-granny-text font-semibold mb-1">Enhanced Gameplay Experience</p>
                  <p className="text-xs text-granny-text-muted">Real-time tracking for immersive horror gameplay</p>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="glass-card p-3 border border-granny-danger/20 bg-granny-danger/5">
                    <p className="text-sm text-granny-text flex items-center gap-2">
                      <span className="text-granny-danger">🔪</span> 
                      <strong>Killers</strong> can track survivor locations on interactive maps
                    </p>
                  </div>
                  <div className="glass-card p-3 border border-granny-warning/20 bg-granny-warning/5">
                    <p className="text-sm text-granny-text flex items-center gap-2">
                      <span className="text-granny-warning">⚠️</span> 
                      <strong>Proximity alerts</strong> when killers get dangerously close
                    </p>
                  </div>
                  <div className="glass-card p-3 border border-granny-survivor/20 bg-granny-survivor/5">
                    <p className="text-sm text-granny-text flex items-center gap-2">
                      <span className="text-granny-survivor">🧭</span> 
                      <strong>Directional guidance</strong> helps hunters track their prey
                    </p>
                  </div>
                  <div className="glass-card p-3 border border-granny-border/20">
                    <p className="text-sm text-granny-text flex items-center gap-2">
                      <span className="text-granny-text">🔒</span> 
                      <strong>Privacy protected</strong> - only shared during active hunts
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="glass-card p-4 border border-granny-survivor/30 bg-granny-survivor/10 mb-6">
                <p className="text-xs text-granny-survivor font-semibold mb-1">
                  🔒 Privacy Guarantee
                </p>
                <p className="text-xs text-granny-text-muted">
                  Your location is only shared with other players during active games and is automatically cleared when games end. No tracking outside of gameplay sessions.
                </p>
              </div>

              <div className="flex gap-4">
                {onSkip && (
                  <button
                    onClick={handleSkip}
                    disabled={isRequesting}
                    className="btn-ghost flex-1 py-3 disabled:opacity-50"
                  >
                    Skip for Now
                  </button>
                )}
                
                <button
                  onClick={handleRequestPermission}
                  disabled={isRequesting}
                  className="btn-secondary flex-1 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequesting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Requesting...</span>
                    </div>
                  ) : (
                    <>📍 Enable Location</>
                  )}
                </button>
              </div>

              <div className="mt-4 text-xs text-granny-text-muted text-center">
                💡 You can change this permission anytime in your browser settings
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}