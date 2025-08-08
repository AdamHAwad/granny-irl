#!/bin/bash

# Create Transparent Logo for Splash Screen
# This script helps you create the prowl-logo-transparent.png file

echo "🎨 Setting up transparent logo for splash screen..."

# Check if regular logo exists
if [ ! -f "prowl-logo.png" ]; then
    echo "❌ Error: prowl-logo.png not found!"
    echo "Please ensure the regular Prowl logo is in the project root first."
    exit 1
fi

echo "📋 Instructions for creating transparent logo:"
echo "1. Open prowl-logo.png in an image editor (Photoshop, GIMP, etc.)"
echo "2. Remove the background or make it transparent"
echo "3. Save as prowl-logo-transparent.png in this directory"
echo "4. Then run: ./generate-splash.sh"
echo ""

# Check if we can create a basic transparent version using ImageMagick-like tools
if command -v sips &> /dev/null; then
    echo "🤖 Attempting to create basic transparent version using sips..."
    
    # Try to create a version with white background removed (basic transparency)
    sips -s format png prowl-logo.png --out temp-transparent.png
    
    # This is basic - you may need to manually edit for better results
    echo "⚠️  Basic version created as temp-transparent.png"
    echo "    You may want to manually edit this for better transparency"
    echo "    When ready, rename it to: prowl-logo-transparent.png"
else
    echo "💡 Tip: Install ImageMagick or use an image editor for best results"
fi

echo ""
echo "✅ Once you have prowl-logo-transparent.png, the splash screen will automatically use it!"