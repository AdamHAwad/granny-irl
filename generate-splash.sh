#!/bin/bash

# Prowl Splash Screen Generator
# This script generates splash screens for iOS and Android

# Check if source image exists
if [ ! -f "prowl-logo.png" ]; then
    echo "❌ Error: prowl-logo.png not found in current directory"
    echo "Please save the Prowl logo as prowl-logo.png in the project root"
    exit 1
fi

echo "🎨 Generating Prowl splash screens..."

# Create iOS splash screens (2732x2732 with white background and centered logo)
echo "📱 Creating iOS splash screens..."

# Create white background and center the logo at about 40% size
logo_size=1100  # 40% of 2732 = ~1100px

# First resize logo to appropriate size
sips -z $logo_size $logo_size prowl-logo.png --out temp-logo.png

# Create white background and composite logo in center
sips -c 2732 2732 --padColor FFFFFF temp-logo.png --out ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png

# Copy for other scales (iOS uses same image for all scales in this case)
cp ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png
cp ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png

# Clean up temp file
rm temp-logo.png

echo "✅ iOS splash screens updated!"

# Create Android splash icon (300x300 for drawable)
echo "🤖 Creating Android splash icon..."
mkdir -p android/app/src/main/res/drawable
sips -z 300 300 prowl-logo.png --out android/app/src/main/res/drawable/splash_icon.png

echo "✅ Android splash icon created!"

# Create launch background XML
cat > android/app/src/main/res/drawable/launch_background.xml << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splashBackground" />
    <item>
        <bitmap
            android:src="@drawable/splash_icon"
            android:gravity="center" />
    </item>
</layer-list>
EOF

# Create/update colors.xml
mkdir -p android/app/src/main/res/values
cat > android/app/src/main/res/values/colors.xml << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="primary">#c41e3a</color>
    <color name="primaryDark">#0a0a0b</color>
    <color name="splashBackground">#ffffff</color>
</resources>
EOF

echo "✅ All splash screens updated!"
echo ""
echo "📝 Next steps:"
echo "1. Run 'npx cap sync' to apply changes"
echo "2. Test the app to see the new Prowl splash screen"