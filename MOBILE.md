# 📱 Granny IRL - Mobile App Development

## Overview
Granny IRL mobile apps use **Capacitor** to create native iOS and Android apps that connect directly to the live web application at `https://granny-irl.vercel.app`. This approach ensures **cross-platform compatibility** - mobile users can play with web users seamlessly while getting native device features like enhanced GPS and camera access.

## 🚀 Quick Start

### Prerequisites
- **Android Development**: Android Studio installed
- **iOS Development**: Xcode installed (macOS only)
- Node.js and npm
- Capacitor CLI installed globally: `npm install -g @capacitor/cli`

### Development Workflow

```bash
# Production Mobile Apps (connects to live web app)
npm run mobile:android    # Build and open Android Studio
npm run mobile:ios        # Build and open Xcode  
npm run mobile:prod       # Run Android app on device
npm run mobile:prod:ios   # Run iOS app on device

# Local Development (for testing mobile features locally)
npm run dev              # Start Next.js development server
npm run mobile:dev:android  # Android with live reload to localhost
npm run mobile:dev       # iOS with live reload to localhost

# Sync Only
npm run mobile:sync      # Sync changes to mobile platforms
```

## 📦 Installed Native Plugins

### Core Plugins
- **@capacitor/app** - App lifecycle management
- **@capacitor/device** - Device information
- **@capacitor/status-bar** - Status bar styling
- **@capacitor/splash-screen** - Launch screen management

### Feature Plugins  
- **@capacitor/geolocation** - GPS location tracking (enhanced)
- **@capacitor/camera** - Camera access for profile pictures
- **@capacitor/filesystem** - File storage management

## 🔧 Configuration

### Capacitor Config (`capacitor.config.ts`)
```typescript
const config: CapacitorConfig = {
  appId: 'com.grannyirl.app',
  appName: 'Granny IRL',
  webDir: 'dist',
  server: {
    // Always connects to live web app for cross-platform play
    url: 'https://granny-irl.vercel.app',
    androidScheme: 'https',
    allowNavigation: ['granny-irl.vercel.app']
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a'
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a1a'
    }
  }
};
```

### Mobile Service Integration
The app includes a `mobileService` that provides:
- **Enhanced Location Tracking**: Uses native GPS when available
- **Camera Integration**: Profile picture capture
- **Device Information**: Platform detection and device details
- **App Lifecycle**: Background/foreground state management

## 🌐 Cross-Platform Benefits

### Seamless Web + Mobile Integration
- **Same Game Sessions**: Mobile users join the same rooms as web users
- **Real-time Sync**: All players see the same game state instantly  
- **Consistent UI**: Identical interface across all platforms
- **No Separate Backend**: Uses the same Supabase database and real-time subscriptions

### Enhanced Mobile Features
- **Native GPS**: More accurate location tracking than browser geolocation
- **Camera Access**: Profile picture capture directly in the app
- **Background App Management**: Proper handling of app lifecycle events
- **Push Notifications**: Ready for game alerts (future feature)
- **Offline Capabilities**: Better caching and offline support

## 🏗️ Architecture

### Hybrid Approach
- **Web Layer**: Next.js application (unchanged)
- **Native Layer**: Capacitor provides native device access
- **Bridge Layer**: `mobileService.ts` handles web/native integration

### Key Features
1. **Location Services**: Enhanced GPS accuracy on native platforms
2. **Camera Integration**: Native camera access for profile pictures  
3. **Push Notifications**: Ready for future implementation
4. **Background Processing**: App state management
5. **Offline Capabilities**: Service worker ready

## 📱 Platform-Specific Features

### Android
- **Location**: High-accuracy GPS with background permissions
- **Camera**: Full camera and gallery access
- **File System**: Local storage for cached data
- **Permissions**: Runtime permission requests

### iOS  
- **Location**: Core Location framework integration
- **Camera**: UIImagePickerController integration
- **Background**: Limited background processing
- **App Store**: Ready for TestFlight and App Store submission

## 🔒 Permissions

### Android (`android/app/src/main/AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### iOS (`ios/App/App/Info.plist`)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to coordinate real-life games with other players.</string>
<key>NSCameraUsageDescription</key>  
<string>This app needs camera access to take profile pictures.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs photo library access to choose profile pictures.</string>
```

## 🚀 Deployment

### Android
1. Build the app: `npm run mobile:sync`
2. Open in Android Studio: `npm run mobile:android`
3. Build APK/Bundle for Google Play Store
4. Sign with release keystore
5. Upload to Google Play Console

### iOS
1. Build the app: `npm run mobile:sync`  
2. Open in Xcode: `npm run mobile:ios`
3. Configure signing & capabilities
4. Build for TestFlight/App Store
5. Upload via Xcode or Transporter

## 🐛 Troubleshooting

### Common Issues

**Build Failures**
- Ensure Next.js builds successfully: `npm run build`
- Check Capacitor sync: `npx cap sync`
- Clear platform caches: `npx cap clean`

**Location Not Working**
- Check platform permissions in device settings
- Verify location services are enabled
- Test with `mobileService.getCurrentLocation()`

**iOS Issues**  
- Install Xcode and CocoaPods
- Run `npx cap sync ios` after plugin changes
- Check iOS deployment target (minimum iOS 13.0)

**Android Issues**
- Update Android SDK and build tools
- Check Gradle compatibility
- Verify Android API levels

## 📋 Development Scripts

```bash
# Development
npm run dev                    # Start Next.js dev server
npm run mobile:dev            # iOS with live reload  
npm run mobile:dev:android    # Android with live reload

# Build & Deploy
npm run build                 # Build Next.js app
npm run mobile:sync          # Build + sync Capacitor
npm run mobile:ios           # Open Xcode
npm run mobile:android       # Open Android Studio

# Maintenance
npx cap clean                # Clear platform builds
npx cap doctor              # Check Capacitor setup
npx cap list                # List installed plugins
```

## 🔮 Future Enhancements

### Planned Features
- **Push Notifications**: Game start/end notifications
- **Background Sync**: Location updates when app backgrounded
- **Offline Mode**: Cached game data for poor connectivity
- **Haptic Feedback**: Vibration for game events
- **App Shortcuts**: Quick actions from home screen

### Performance Optimizations
- **Image Optimization**: WebP support for faster loading
- **Code Splitting**: Lazy load game components
- **Caching**: Service worker for offline capabilities
- **Bundle Analysis**: Reduce app size

---

## 💡 Tips for Development

1. **Always test on real devices** for location and camera features
2. **Use Chrome DevTools** to debug the web layer via `chrome://inspect`
3. **Enable live reload** during development for faster iteration
4. **Check native logs** in Xcode/Android Studio for platform issues
5. **Test offline scenarios** to ensure graceful degradation

---

**Status**: ✅ Mobile development setup complete  
**Next Steps**: Add app icons, test native features, prepare for app store submission