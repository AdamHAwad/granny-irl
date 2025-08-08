#!/bin/bash

# Prowl Icon Cleanup Script
# This script removes all generated icons so you can regenerate them

echo "🧹 Cleaning up existing Prowl icons..."

# iOS Icons
echo "📱 Removing iOS icons..."
rm -f ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-*.png

# Android Icons
echo "🤖 Removing Android icons..."
rm -f android/app/src/main/res/mipmap-mdpi/ic_launcher.png
rm -f android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
rm -f android/app/src/main/res/mipmap-hdpi/ic_launcher.png
rm -f android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
rm -f android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
rm -f android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
rm -f android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
rm -f android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
rm -f android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
rm -f android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png

# Android Splash Icon
rm -f android/app/src/main/res/drawable/splash_icon.png

# PWA/Web Icons
echo "🌐 Removing PWA icons..."
rm -f public/icon-72x72.png
rm -f public/icon-96x96.png
rm -f public/icon-128x128.png
rm -f public/icon-144x144.png
rm -f public/icon-152x152.png
rm -f public/icon-192x192.png
rm -f public/icon-384x384.png
rm -f public/icon-512x512.png
rm -f public/favicon-32x32.png
rm -f public/favicon-16x16.png
rm -f public/apple-touch-icon.png

echo "✅ Icon cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Replace 'prowl-logo.png' with the correct logo"
echo "2. Run './generate-icons.sh' to regenerate all icons"
echo "3. Run 'npm run mobile:sync' to apply changes"