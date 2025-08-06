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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full text-black">
        <h2 className="text-xl font-bold mb-4 text-center">📍 Location Access</h2>
        
        {permissionStatus?.granted ? (
          <div className="text-center">
            <div className="text-green-600 mb-4">✅ Location access granted!</div>
            <p className="text-sm text-gray-600">
              Your location will be shared with other players during the game.
            </p>
          </div>
        ) : permissionStatus?.denied ? (
          <div className="text-center">
            <div className="text-red-600 mb-4">❌ Location access denied</div>
            <p className="text-sm text-gray-600 mb-4">
              {permissionStatus.error || 'Location permission is required for the enhanced gameplay experience.'}
            </p>
            <div className="text-xs text-gray-500 mb-4">
              To enable location access:
              <br />1. Click the location icon in your address bar
              <br />2. Select &quot;Allow&quot; for location permissions
              <br />3. Refresh the page and try again
            </div>
            {onSkip && (
              <button
                onClick={handleSkip}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Continue Without Location
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <p className="text-gray-700 mb-3">
                🎯 <strong>Enhanced Gameplay Experience</strong>
              </p>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• <strong>Killers</strong> can see survivor locations on a map</p>
                <p>• <strong>Proximity alerts</strong> when killers get close to survivors</p>
                <p>• <strong>Directional arrows</strong> help killers track their targets</p>
                <p>• <strong>Privacy protected</strong> - locations only shared during active games</p>
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <p className="text-xs text-blue-800">
                🔒 <strong>Privacy Note:</strong> Your location is only shared with other players during active games and is automatically cleared when games end.
              </p>
            </div>

            <div className="flex gap-3">
              {onSkip && (
                <button
                  onClick={handleSkip}
                  disabled={isRequesting}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Skip for Now
                </button>
              )}
              
              <button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {isRequesting ? 'Requesting...' : 'Enable Location'}
              </button>
            </div>

            <div className="mt-3 text-xs text-gray-500 text-center">
              You can change this permission anytime in your browser settings
            </div>
          </div>
        )}
      </div>
    </div>
  );
}