#!/bin/bash

# Prowl Splash Screen Generator
# This script generates splash screens for iOS and Android

# Check if transparent logo exists, fallback to regular logo
LOGO_FILE="prowl-logo-transparent.png"
if [ ! -f "$LOGO_FILE" ]; then
    LOGO_FILE="prowl-logo.png"
    if [ ! -f "$LOGO_FILE" ]; then
        echo "❌ Error: Neither prowl-logo-transparent.png nor prowl-logo.png found"
        echo "Please save the Prowl logo in the project root"
        exit 1
    fi
    echo "⚠️  Using prowl-logo.png (transparent version not found)"
else
    echo "✅ Using prowl-logo-transparent.png"
fi

echo "🎨 Generating Prowl splash screens..."

# Create iOS splash screens (2732x2732 with black background and centered logo)
echo "📱 Creating iOS splash screens..."

# Create black background and center the logo at about 40% size
logo_size=1100  # 40% of 2732 = ~1100px

# First resize logo to appropriate size
sips -z $logo_size $logo_size "$LOGO_FILE" --out temp-logo.png

# Create black background and composite logo in center
sips -c 2732 2732 --padColor 000000 temp-logo.png --out ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png

# Copy for other scales (iOS uses same image for all scales in this case)
cp ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png
cp ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png

# Clean up temp file
rm temp-logo.png

echo "✅ iOS splash screens updated!"

# Create Android splash icon (300x300 for drawable)
echo "🤖 Creating Android splash icon..."
mkdir -p android/app/src/main/res/drawable
sips -z 300 300 "$LOGO_FILE" --out android/app/src/main/res/drawable/splash_icon.png

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
    <color name="splashBackground">#000000</color>
</resources>
EOF

echo "✅ All splash screens updated!"
echo ""
echo "📝 Next steps:"
echo "1. Run 'npx cap sync' to apply changes"
echo "2. Test the app to see the new Prowl splash screen"