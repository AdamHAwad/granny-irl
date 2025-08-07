/**
 * Permission Manager - Centralized permission handling for Granny IRL
 * 
 * Features:
 * - Requests all necessary permissions on app startup
 * - Handles both web and mobile platforms
 * - Provides unified permission status tracking
 * - Graceful degradation when permissions denied
 */

import { mobileService } from './mobileService';
import { locationService } from './locationService';

export interface PermissionStatus {
  location: 'granted' | 'denied' | 'prompt';
  deviceOrientation: 'granted' | 'denied' | 'prompt' | 'not-available';
  camera: 'granted' | 'denied' | 'prompt' | 'not-available';
  notifications: 'granted' | 'denied' | 'prompt' | 'not-available';
}

export interface PermissionRequestResult {
  success: boolean;
  permissions: PermissionStatus;
  errors: string[];
}

class PermissionManager {
  private currentPermissions: PermissionStatus = {
    location: 'prompt',
    deviceOrientation: 'not-available',
    camera: 'not-available',
    notifications: 'not-available'
  };

  private hasRequestedOnStartup = false;

  /**
   * Check current status of all permissions without requesting them
   */
  async checkAllPermissions(): Promise<PermissionStatus> {
    console.log('PermissionManager: Checking current permission status');

    const permissions: PermissionStatus = {
      location: 'prompt',
      deviceOrientation: 'not-available',
      camera: 'not-available',
      notifications: 'not-available'
    };

    // Check location permission
    if (mobileService.isMobile()) {
      try {
        const result = await mobileService.requestLocationPermission();
        permissions.location = result.state as 'granted' | 'denied';
      } catch (error) {
        console.error('PermissionManager: Error checking mobile location permission:', error);
        permissions.location = 'denied';
      }
    } else {
      // Web platform
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          permissions.location = result.state as 'granted' | 'denied' | 'prompt';
        } catch (error) {
          console.error('PermissionManager: Error checking web location permission:', error);
        }
      }
    }

    // Check device orientation (compass) permission
    if ('DeviceOrientationEvent' in window) {
      permissions.deviceOrientation = 'prompt';
      
      // iOS 13+ requires explicit permission request
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          // Don't actually request here, just check if it's available
          permissions.deviceOrientation = 'prompt';
        } catch (error) {
          permissions.deviceOrientation = 'denied';
        }
      } else {
        // Older browsers/Android - usually available without explicit permission
        permissions.deviceOrientation = 'granted';
      }
    }

    // Check camera permission (mobile only)
    if (mobileService.isMobile()) {
      permissions.camera = 'prompt'; // Capacitor Camera handles permissions automatically
    }

    // Check notification permission (not critical for core gameplay)
    if ('Notification' in window) {
      const permission = Notification.permission;
      permissions.notifications = permission === 'default' ? 'prompt' : permission as 'granted' | 'denied';
    }

    this.currentPermissions = permissions;
    return permissions;
  }

  /**
   * Request all necessary permissions for optimal gameplay
   */
  async requestAllPermissions(): Promise<PermissionRequestResult> {
    console.log('PermissionManager: Requesting all necessary permissions');
    
    const errors: string[] = [];
    let allGranted = true;

    // First check current status
    await this.checkAllPermissions();

    // Request location permission (critical for gameplay)
    if (this.currentPermissions.location !== 'granted') {
      try {
        const locationResult = await locationService.requestPermission();
        if (locationResult.granted) {
          this.currentPermissions.location = 'granted';
          console.log('PermissionManager: ✅ Location permission granted');
        } else {
          this.currentPermissions.location = 'denied';
          allGranted = false;
          errors.push(locationResult.error || 'Location permission denied');
          console.log('PermissionManager: ❌ Location permission denied');
        }
      } catch (error) {
        allGranted = false;
        errors.push('Failed to request location permission');
        console.error('PermissionManager: Error requesting location permission:', error);
      }
    } else {
      console.log('PermissionManager: ✅ Location permission already granted');
    }

    // Request device orientation permission (for compass features)
    if (this.currentPermissions.deviceOrientation === 'prompt') {
      try {
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          const result = await (DeviceOrientationEvent as any).requestPermission();
          if (result === 'granted') {
            this.currentPermissions.deviceOrientation = 'granted';
            console.log('PermissionManager: ✅ Device orientation permission granted');
          } else {
            this.currentPermissions.deviceOrientation = 'denied';
            console.log('PermissionManager: ❌ Device orientation permission denied');
          }
        } else {
          // Assume granted for older browsers/Android
          this.currentPermissions.deviceOrientation = 'granted';
          console.log('PermissionManager: ✅ Device orientation available (no explicit permission needed)');
        }
      } catch (error) {
        this.currentPermissions.deviceOrientation = 'denied';
        console.error('PermissionManager: Error requesting device orientation permission:', error);
      }
    }

    // Optional: Request notification permission (non-blocking)
    if (this.currentPermissions.notifications === 'prompt' && 'Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        this.currentPermissions.notifications = result as 'granted' | 'denied';
        if (result === 'granted') {
          console.log('PermissionManager: ✅ Notification permission granted');
        } else {
          console.log('PermissionManager: ❌ Notification permission denied');
        }
      } catch (error) {
        console.error('PermissionManager: Error requesting notification permission:', error);
      }
    }

    console.log('PermissionManager: Permission request completed', {
      success: allGranted,
      permissions: this.currentPermissions,
      errors
    });

    return {
      success: allGranted,
      permissions: this.currentPermissions,
      errors
    };
  }

  /**
   * Request permissions on app startup (only once per session)
   */
  async requestPermissionsOnStartup(): Promise<PermissionRequestResult> {
    if (this.hasRequestedOnStartup) {
      console.log('PermissionManager: Permissions already requested on startup');
      return {
        success: true,
        permissions: this.currentPermissions,
        errors: []
      };
    }

    this.hasRequestedOnStartup = true;
    console.log('PermissionManager: Requesting permissions on app startup');

    // Add a small delay to avoid overwhelming the user immediately
    await new Promise(resolve => setTimeout(resolve, 1000));

    return await this.requestAllPermissions();
  }

  /**
   * Get current permission status
   */
  getCurrentPermissions(): PermissionStatus {
    return { ...this.currentPermissions };
  }

  /**
   * Check if all critical permissions are granted
   */
  hasCriticalPermissions(): boolean {
    return this.currentPermissions.location === 'granted';
  }

  /**
   * Check if enhanced features are available (compass, etc.)
   */
  hasEnhancedFeatures(): boolean {
    return this.currentPermissions.deviceOrientation === 'granted';
  }

  /**
   * Reset permission request flag (for testing/debugging)
   */
  resetStartupFlag(): void {
    this.hasRequestedOnStartup = false;
  }

  /**
   * Get user-friendly permission status message
   */
  getPermissionStatusMessage(): string {
    const status = this.currentPermissions;
    
    if (status.location === 'granted') {
      const enhanced = status.deviceOrientation === 'granted' ? ' with compass support' : '';
      return `✅ All permissions ready${enhanced}`;
    } else if (status.location === 'denied') {
      return '❌ Location permission required for gameplay';
    } else {
      return '⏳ Permissions not yet configured';
    }
  }
}

// Export singleton instance
export const permissionManager = new PermissionManager();