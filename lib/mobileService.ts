import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
// Removed Google Auth plugin - using manual auth instead

export const mobileService = {
  // Check if we're running on a mobile platform
  isMobile() {
    return Capacitor.isNativePlatform();
  },

  // Get device information
  async getDeviceInfo() {
    return await Device.getInfo();
  },

  // Enhanced location service for mobile
  async getCurrentLocation(): Promise<Position> {
    if (!this.isMobile()) {
      // Fallback to browser geolocation
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy || 0,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp
            });
          },
          reject,
          { 
            enableHighAccuracy: true, 
            timeout: 10000, 
            maximumAge: 30000 
          }
        );
      });
    }

    // Use native geolocation on mobile
    return await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000
    });
  },

  // Watch position with enhanced mobile capabilities
  async watchPosition(callback: (position: Position | null) => void) {
    if (!this.isMobile()) {
      // Fallback to browser geolocation
      return navigator.geolocation.watchPosition(
        (position) => {
          callback({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy || 0,
              altitude: position.coords.altitude,
              altitudeAccuracy: position.coords.altitudeAccuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
            },
            timestamp: position.timestamp
          });
        },
        (error) => console.error('Location watch error:', error),
        { 
          enableHighAccuracy: true, 
          timeout: 5000, 
          maximumAge: 5000 
        }
      );
    }

    // Use native geolocation on mobile
    return await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 5000
    }, callback);
  },

  // Clear position watch
  async clearWatch(watchId: string | number) {
    if (!this.isMobile()) {
      navigator.geolocation.clearWatch(watchId as number);
      return;
    }
    await Geolocation.clearWatch({ id: watchId as string });
  },

  // Take photo for profile picture
  async takePicture() {
    if (!this.isMobile()) {
      throw new Error('Camera not available in browser');
    }

    const image = await Camera.getPhoto({
      quality: 80,
      allowEditing: true,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt, // Let user choose camera or gallery
      width: 300,
      height: 300
    });

    return image;
  },

  // Request permissions (handled by plugins automatically on mobile)
  async requestLocationPermission() {
    if (!this.isMobile()) {
      // Browser permission request
      return await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    }

    // On mobile, use Capacitor's permission request
    try {
      const result = await Geolocation.checkPermissions();
      console.log('Current location permissions:', result);
      
      if (result.location === 'granted') {
        return { state: 'granted' };
      } else if (result.location === 'denied') {
        return { state: 'denied' };
      } else {
        // Request permission
        const permission = await Geolocation.requestPermissions();
        console.log('Permission request result:', permission);
        
        if (permission.location === 'granted') {
          return { state: 'granted' };
        } else {
          return { state: 'denied' };
        }
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return { state: 'denied' };
    }
  },

  // App state management
  onAppStateChange(callback: (isActive: boolean) => void) {
    if (!this.isMobile()) return;

    App.addListener('appStateChange', ({ isActive }) => {
      callback(isActive);
    });
  },

  // Remove all listeners
  removeAllListeners() {
    if (!this.isMobile()) return;
    App.removeAllListeners();
  },

  // Handle OAuth flows for mobile - FORCE in-app browser
  async openOAuthUrl(url: string, onComplete?: () => void) {
    if (!this.isMobile()) {
      // Fallback to regular window.open for web
      window.open(url, '_blank');
      return;
    }

    console.log('FORCE Opening OAuth URL in Capacitor Browser plugin:', url);

    try {
      // STRATEGY: Multiple attempts to force in-app browser
      
      // Method 1: Try with different presentation styles
      const browserOptions = [
        { presentationStyle: 'fullscreen' as 'fullscreen', toolbarColor: '#1a1a1a' },
        { presentationStyle: 'popover' as 'popover', toolbarColor: '#1a1a1a' },
        { windowName: '_blank', toolbarColor: '#1a1a1a' }
      ];

      let success = false;
      
      for (const options of browserOptions) {
        try {
          console.log('Trying browser with options:', options);
          
          await Browser.open({
            url: url,
            ...options
          });
          
          console.log('Browser opened with options:', options);
          success = true;
          break;
        } catch (err) {
          console.error('Browser option failed:', options, err);
        }
      }
      
      if (!success) {
        // Method 2: Force with minimal options
        console.log('All options failed, trying minimal config...');
        await Browser.open({ url });
      }
      
      // Listen for browser finished event
      Browser.addListener('browserFinished', async () => {
        console.log('Browser closed via browserFinished event');
        if (onComplete) onComplete();
      });

      // Also listen for browser page loaded (in case it helps)
      Browser.addListener('browserPageLoaded', async () => {
        console.log('Browser page loaded');
      });
      
    } catch (error) {
      console.error('ALL browser opening methods failed:', error);
      
      // LAST RESORT: Alert user and try system browser
      alert('Unable to open in-app browser. Opening in system browser. Please return to the app after signing in.');
      window.open(url, '_blank');
      
      // Still try to detect when user returns
      if (onComplete) {
        // Monitor app state changes
        App.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            console.log('App became active - user may have returned from system browser');
            setTimeout(() => {
              onComplete();
            }, 1000);
          }
        });
      }
    }
  },

  // Listen for URL changes (OAuth callbacks)
  onUrlChange(callback: (url: string) => void) {
    if (!this.isMobile()) return;

    App.addListener('appUrlOpen', (event) => {
      callback(event.url);
    });
  },

  // Native Google Sign-In removed - using manual auth instead

  // Force open URL in system browser (Chrome) - bypasses in-app browser
  async openInSystemBrowser(url: string) {
    if (!this.isMobile()) {
      // Web fallback
      window.open(url, '_blank');
      return;
    }

    console.log('Forcing system browser (Chrome) for URL:', url);
    
    try {
      // Method 1: Try Capacitor Browser with _system target
      await Browser.open({
        url: url,
        windowName: '_system'
      });
      console.log('Opened in system browser via Capacitor Browser');
    } catch (error) {
      console.error('Capacitor Browser failed, trying alternatives:', error);
      
      try {
        // Method 2: Force window.location (should trigger system browser)
        window.location.href = url;
        console.log('Opened via window.location.href');
      } catch (fallbackError) {
        console.error('All system browser methods failed:', fallbackError);
        throw new Error('Cannot open system browser');
      }
    }
  }
};