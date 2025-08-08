#!/bin/bash

# Fix iOS icon naming for Xcode
cd ios/App/App/Assets.xcassets/AppIcon.appiconset/

echo "🔧 Fixing iOS icon names for Xcode..."

# Create copies with the names Xcode expects
cp AppIcon-60x60@2x.png AppIcon60x60@2x.png 2>/dev/null || echo "AppIcon-60x60@2x.png not found"
cp AppIcon-76x76@2x.png AppIcon76x76@2x-ipad.png 2>/dev/null || echo "AppIcon-76x76@2x.png not found"

# For the specific files mentioned in the error
if [ -f "AppIcon-60x60@2x.png" ]; then
    cp AppIcon-60x60@2x.png "AppIcon60x60@2x.png"
    echo "✅ Created AppIcon60x60@2x.png"
fi

if [ -f "AppIcon-76x76@2x.png" ]; then
    cp AppIcon-76x76@2x.png "AppIcon76x76@2x-ipad.png"
    echo "✅ Created AppIcon76x76@2x-ipad.png"
fi

# Also check if we need the old 512@2x icon
if [ -f "AppIcon-1024x1024.png" ]; then
    cp AppIcon-1024x1024.png "AppIcon-512@2x.png"
    echo "✅ Created AppIcon-512@2x.png"
fi

echo "✅ Icon naming fixed!"
echo ""
echo "Next steps:"
echo "1. Clean build folder in Xcode (Cmd+Shift+K)"
echo "2. Try building again"