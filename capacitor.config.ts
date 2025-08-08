import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.prowl.app',
  appName: 'Prowl',
  webDir: 'dist',
  server: {
    // Always use the live web app for cross-platform compatibility
    url: 'https://granny-irl.vercel.app?capacitor=true',
    androidScheme: 'https',
    // Remove OAuth domains from allowNavigation to force system browser
    allowNavigation: ['granny-irl.vercel.app'],
    // Disable caching to always get fresh content
    cleartext: true
  },
  plugins: {
    // Configure native plugins
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#ffffff', // Use white background to match splash images
      showSpinner: false,
      // Hide the splash screen automatically
      launchAutoHide: true
    },
    StatusBar: {
      style: 'light', // Better contrast for the app
      backgroundColor: '#1a1a1a'
    },
    Browser: {
      // Force in-app browser behavior
      presentationStyle: 'fullscreen',
      toolbarColor: '#1a1a1a',
      windowName: '_self',
      // Try to override system browser
      overrideUserAgent: 'ProwlApp/1.0'
    }
  }
};

export default config;
