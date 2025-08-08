#!/bin/bash

# Prowl App Icon Generator
# This script generates all required icon sizes for iOS, Android, and PWA

# Check if source image exists
if [ ! -f "prowl-logo.png" ]; then
    echo "Error: prowl-logo.png not found in current directory"
    echo "Please save the Prowl logo as prowl-logo.png in the project root"
    exit 1
fi

echo "🎨 Generating Prowl app icons..."

# iOS App Icon sizes
echo "📱 Generating iOS icons..."
# iPhone icons
sips -z 40 40 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-20x20@2x.png
sips -z 60 60 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-20x20@3x.png
sips -z 58 58 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-29x29@2x.png
sips -z 87 87 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-29x29@3x.png
sips -z 80 80 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-40x40@2x.png
sips -z 120 120 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-40x40@3x.png
sips -z 120 120 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-60x60@2x.png
sips -z 180 180 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-60x60@3x.png

# iPad icons
sips -z 20 20 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-20x20@1x.png
sips -z 29 29 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-29x29@1x.png
sips -z 40 40 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-40x40@1x.png
sips -z 76 76 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-76x76@1x.png
sips -z 152 152 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-76x76@2x.png
sips -z 167 167 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-83.5x83.5@2x.png

# App Store icon
sips -z 1024 1024 prowl-logo.png --out ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024x1024.png

# Android App Icon sizes
echo "🤖 Generating Android icons..."
sips -z 48 48 prowl-logo.png --out android/app/src/main/res/mipmap-mdpi/ic_launcher.png
sips -z 72 72 prowl-logo.png --out android/app/src/main/res/mipmap-hdpi/ic_launcher.png
sips -z 96 96 prowl-logo.png --out android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
sips -z 144 144 prowl-logo.png --out android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
sips -z 192 192 prowl-logo.png --out android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

# Round icons for Android
cp android/app/src/main/res/mipmap-mdpi/ic_launcher.png android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
cp android/app/src/main/res/mipmap-hdpi/ic_launcher.png android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
cp android/app/src/main/res/mipmap-xhdpi/ic_launcher.png android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
cp android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
cp android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png

# PWA icons
echo "🌐 Generating PWA icons..."
sips -z 72 72 prowl-logo.png --out public/icon-72x72.png
sips -z 96 96 prowl-logo.png --out public/icon-96x96.png
sips -z 128 128 prowl-logo.png --out public/icon-128x128.png
sips -z 144 144 prowl-logo.png --out public/icon-144x144.png
sips -z 152 152 prowl-logo.png --out public/icon-152x152.png
sips -z 192 192 prowl-logo.png --out public/icon-192x192.png
sips -z 384 384 prowl-logo.png --out public/icon-384x384.png
sips -z 512 512 prowl-logo.png --out public/icon-512x512.png

# Favicon
echo "🔖 Generating favicon..."
sips -z 32 32 prowl-logo.png --out public/favicon-32x32.png
sips -z 16 16 prowl-logo.png --out public/favicon-16x16.png

# Apple touch icon
sips -z 180 180 prowl-logo.png --out public/apple-touch-icon.png

echo "✅ Icon generation complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run mobile:sync' to sync icons to mobile platforms"
echo "2. For iOS, you may need to manually update the Assets.xcassets in Xcode"
echo "3. For Android, icons should appear automatically after sync"