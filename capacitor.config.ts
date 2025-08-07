import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.grannyirl.app',
  appName: 'Granny IRL',
  webDir: 'dist',
  server: {
    // Always use the live web app for cross-platform compatibility
    url: 'https://granny-irl.vercel.app?capacitor=true',
    androidScheme: 'https',
    // Remove OAuth domains from allowNavigation to force system browser
    allowNavigation: ['granny-irl.vercel.app']
  },
  plugins: {
    // Configure native plugins
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a', // Match your dark theme
      showSpinner: false
    },
    StatusBar: {
      style: 'dark', // Match your app theme
      backgroundColor: '#1a1a1a'
    },
    Browser: {
      // Force in-app browser behavior
      presentationStyle: 'fullscreen',
      toolbarColor: '#1a1a1a',
      windowName: '_self',
      // Try to override system browser
      overrideUserAgent: 'GrannyIRLApp/1.0'
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '20328927068-en1cmbti4ponfronn7g307lmqt5njabq.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
