import { PlayerLocation } from '@/types/game';

export interface LocationPermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
  error?: string;
}

export interface LocationWatchOptions {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
}

// Default location watch options optimized for outdoor gameplay
export const DEFAULT_LOCATION_OPTIONS: LocationWatchOptions = {
  enableHighAccuracy: true, // Use GPS for better accuracy
  timeout: 10000, // 10 seconds timeout
  maximumAge: 30000, // Accept location up to 30 seconds old
};

class LocationService {
  private watchId: number | null = null;
  private lastKnownLocation: PlayerLocation | null = null;
  private isWatching = false;

  /**
   * Check if geolocation is supported by the browser
   */
  isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Check if device orientation is supported (for compass heading)
   */
  isOrientationSupported(): boolean {
    return 'DeviceOrientationEvent' in window;
  }

  /**
   * Request location permission from the user
   */
  async requestPermission(): Promise<LocationPermissionStatus> {
    console.log('LocationService: Requesting location permission');

    if (!this.isSupported()) {
      return {
        granted: false,
        denied: true,
        prompt: false,
        error: 'Geolocation is not supported by this browser'
      };
    }

    try {
      // Check current permission state
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        console.log('LocationService: Current permission state:', permission.state);

        if (permission.state === 'granted') {
          return { granted: true, denied: false, prompt: false };
        } else if (permission.state === 'denied') {
          return { 
            granted: false, 
            denied: true, 
            prompt: false, 
            error: 'Location permission denied. Please enable location access in your browser settings.' 
          };
        }
      }

      // Request location access (this will prompt the user)
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('LocationService: Permission granted', position);
            resolve({ granted: true, denied: false, prompt: false });
          },
          (error) => {
            console.error('LocationService: Permission denied or error:', error);
            let errorMessage = 'Location access denied';
            
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information unavailable. Please check your GPS settings.';
                break;
              case error.TIMEOUT:
                errorMessage = 'Location request timed out. Please try again.';
                break;
            }

            resolve({ 
              granted: false, 
              denied: true, 
              prompt: false, 
              error: errorMessage 
            });
          },
          DEFAULT_LOCATION_OPTIONS
        );
      });
    } catch (error) {
      console.error('LocationService: Error requesting permission:', error);
      return {
        granted: false,
        denied: true,
        prompt: false,
        error: 'Failed to request location permission'
      };
    }
  }

  /**
   * Get current location once
   */
  async getCurrentLocation(): Promise<PlayerLocation> {
    console.log('LocationService: Getting current location');

    if (!this.isSupported()) {
      throw new Error('Geolocation is not supported');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: PlayerLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };

          console.log('LocationService: Got current location:', location);
          this.lastKnownLocation = location;
          resolve(location);
        },
        (error) => {
          console.error('LocationService: Error getting location:', error);
          reject(new Error(`Location error: ${error.message}`));
        },
        DEFAULT_LOCATION_OPTIONS
      );
    });
  }

  /**
   * Start watching location changes
   */
  startWatching(
    onLocationUpdate: (location: PlayerLocation) => void,
    onError?: (error: string) => void,
    options: LocationWatchOptions = DEFAULT_LOCATION_OPTIONS
  ): void {
    console.log('LocationService: Starting location watch');

    if (!this.isSupported()) {
      onError?.('Geolocation is not supported');
      return;
    }

    if (this.isWatching) {
      console.log('LocationService: Already watching location');
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: PlayerLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        console.log('LocationService: Location updated:', location);
        this.lastKnownLocation = location;
        onLocationUpdate(location);
      },
      (error) => {
        console.error('LocationService: Watch error:', error);
        onError?.(error.message);
      },
      options
    );

    this.isWatching = true;
    console.log('LocationService: Started watching with ID:', this.watchId);
  }

  /**
   * Stop watching location changes
   */
  stopWatching(): void {
    console.log('LocationService: Stopping location watch');

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.isWatching = false;
    console.log('LocationService: Stopped watching location');
  }

  /**
   * Get device compass heading (requires device orientation permission)
   */
  async getDeviceHeading(): Promise<number | null> {
    if (!this.isOrientationSupported()) {
      console.log('LocationService: Device orientation not supported');
      return null;
    }

    // Request permission for device orientation (iOS 13+)
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission !== 'granted') {
          console.log('LocationService: Device orientation permission denied');
          return null;
        }
      } catch (error) {
        console.error('LocationService: Error requesting orientation permission:', error);
        return null;
      }
    }

    return new Promise((resolve) => {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        // Remove event listener after first reading
        window.removeEventListener('deviceorientation', handleOrientation);
        
        // alpha is the compass heading (0-360 degrees)
        const heading = event.alpha;
        console.log('LocationService: Device heading:', heading);
        resolve(heading);
      };

      window.addEventListener('deviceorientation', handleOrientation);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('deviceorientation', handleOrientation);
        resolve(null);
      }, 5000);
    });
  }

  /**
   * Calculate distance between two locations in meters
   */
  calculateDistance(
    location1: PlayerLocation,
    location2: PlayerLocation
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (location1.latitude * Math.PI) / 180;
    const φ2 = (location2.latitude * Math.PI) / 180;
    const Δφ = ((location2.latitude - location1.latitude) * Math.PI) / 180;
    const Δλ = ((location2.longitude - location1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Calculate bearing (direction) from one location to another in degrees
   */
  calculateBearing(
    from: PlayerLocation,
    to: PlayerLocation
  ): number {
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const bearing = (Math.atan2(y, x) * 180) / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360 degrees
  }

  /**
   * Get last known location
   */
  getLastKnownLocation(): PlayerLocation | null {
    return this.lastKnownLocation;
  }

  /**
   * Check if currently watching location
   */
  getIsWatching(): boolean {
    return this.isWatching;
  }
}

// Export singleton instance
export const locationService = new LocationService();