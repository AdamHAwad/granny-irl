# Prowl App Icon & Splash Screen Setup

## Prerequisites
1. Save the Prowl logo as `prowl-logo.png` in the project root directory
2. Ensure the logo has a transparent background and is at least 1024x1024 pixels

## Automatic Icon Generation

### Step 1: Generate All Icons
```bash
./generate-icons.sh
```

This will create:
- iOS app icons (all required sizes)
- Android app icons (all densities)
- PWA icons for web app
- Favicons

### Step 2: Generate Splash Screens
```bash
./generate-splash.sh
```

## Manual Splash Screen Creation

### iOS Splash Screen
Since we need a splash screen with the logo centered on a dark background (#0a0a0b), you'll need to:

1. Create a 2732x2732 image with:
   - Dark background (#0a0a0b)
   - Prowl logo centered
   - Logo at about 40% of the total size

2. Save it as `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`

### Android Splash Screen
The Android splash is automatically configured to show the logo on the app's background color.

## Apply Changes

After generating all assets:

```bash
# Sync to mobile platforms
npm run mobile:sync

# For iOS
npm run mobile:ios

# For Android  
npm run mobile:android
```

## Verifying Icons

### iOS
1. Open Xcode
2. Navigate to App > Assets.xcassets > AppIcon
3. All icon slots should be filled

### Android
1. Check `android/app/src/main/res/mipmap-*` directories
2. Each should contain `ic_launcher.png` and `ic_launcher_round.png`

### Web
1. Check `public/` directory for all icon sizes
2. Verify manifest.json references correct icons

## Troubleshooting

If icons don't appear:
1. Clean build: `npx cap sync --clean`
2. For iOS: Clean build folder in Xcode (Cmd+Shift+K)
3. For Android: `cd android && ./gradlew clean`