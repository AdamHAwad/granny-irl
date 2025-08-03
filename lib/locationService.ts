/**
 * Location Service - GPS tracking and geolocation utilities for Granny IRL
 * 
 * Features:
 * - Browser Geolocation API wrapper with error handling
 * - High-frequency location tracking during games (5s updates)
 * - Device orientation/compass support for directional arrows
 * - Distance and bearing calculations using Haversine formula
 * - Privacy-focused permission management
 * 
 * Usage patterns:
 * - Request permission before starting tracking
 * - Use HIGH_FREQUENCY_LOCATION_OPTIONS during active games
 * - Always call stopWatching() when games end
 * - Handle graceful degradation when GPS unavailable
 */

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

// Optimized location options for active games (balanced performance/accuracy)
export const HIGH_FREQUENCY_LOCATION_OPTIONS: LocationWatchOptions = {
  enableHighAccuracy: true, // Use GPS for better accuracy
  timeout: 8000, // 8 seconds timeout (more reliable)
  maximumAge: 3000, // Accept location up to 3 seconds old
};

class LocationService {
  private watchId: number | null = null;
  private lastKnownLocation: PlayerLocation | null = null;
  private isWatching = false;
  private lastUpdateTime = 0;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private updateCallbacks: Array<(location: PlayerLocation) => void> = [];

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
   * Start watching location changes with optimized debouncing
   */
  startWatching(
    onLocationUpdate: (location: PlayerLocation) => void,
    onError?: (error: string) => void,
    options: LocationWatchOptions = DEFAULT_LOCATION_OPTIONS
  ): void {
    console.log('LocationService: Starting optimized location watch');

    if (!this.isSupported()) {
      onError?.('Geolocation is not supported');
      return;
    }

    if (this.isWatching) {
      // Add to existing callbacks instead of creating new watch
      this.updateCallbacks.push(onLocationUpdate);
      console.log('LocationService: Added callback to existing watch');
      return;
    }

    this.updateCallbacks = [onLocationUpdate];

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        
        // Throttle updates to max once every 2 seconds for performance
        if (now - this.lastUpdateTime < 2000) {
          return;
        }

        const location: PlayerLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        // Skip if location hasn't changed significantly (within 5 meters)
        if (this.lastKnownLocation) {
          const distance = this.calculateDistance(this.lastKnownLocation, location);
          if (distance < 5 && location.accuracy && location.accuracy < 20) {
            return;
          }
        }

        console.log('LocationService: Significant location update:', location);
        this.lastKnownLocation = location;
        this.lastUpdateTime = now;
        
        // Debounce multiple rapid updates
        if (this.debounceTimeout) {
          clearTimeout(this.debounceTimeout);
        }
        
        this.debounceTimeout = setTimeout(() => {
          this.updateCallbacks.forEach(callback => {
            try {
              callback(location);
            } catch (error) {
              console.error('LocationService: Error in callback:', error);
            }
          });
        }, 500); // 500ms debounce
      },
      (error) => {
        console.error('LocationService: Watch error:', error);
        onError?.(error.message);
      },
      options
    );

    this.isWatching = true;
    console.log('LocationService: Started optimized watching with ID:', this.watchId);
  }

  /**
   * Stop watching location changes with proper cleanup
   */
  stopWatching(): void {
    console.log('LocationService: Stopping optimized location watch');

    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.updateCallbacks = [];
    this.isWatching = false;
    console.log('LocationService: Stopped watching location with cleanup');
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