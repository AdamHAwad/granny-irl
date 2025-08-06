# Granny IRL 🎯

Real-life outdoor tag game coordinator. Think "Friday the 13th" meets "Pokémon GO" with Dead by Daylight-style mechanics - killers hunt survivors in the real world using GPS tracking.

**🌐 Live App**: https://granny-irl.vercel.app

## ✨ Features

### 🎮 Core Gameplay
- **Room-based multiplayer** with 6-digit join codes
- **Killer vs Survivor dynamics** with configurable team sizes
- **Real-time GPS tracking** for killers to hunt survivors
- **Interactive maps** showing real streets and terrain
- **Proximity alerts** when killers get close
- **Self-elimination system** for caught survivors
- **NEW: Dead by Daylight-style skillcheck minigames** ⚡
- **NEW: Escape area mechanics** - first survivor to escape wins! 🚪

### 🗺️ Location Features
- **OpenStreetMap integration** (free, no API keys needed)
- **Pinch-to-zoom, drag-to-pan** map controls
- **Player markers** with profile pictures
- **Directional arrows** pointing to nearest targets
- **Distance calculations** and accuracy circles
- **Privacy controls** - location only shared during games

### 📱 Mobile-Optimized
- **Touch-friendly interface** for outdoor play
- **Battery-conscious** GPS tracking
- **Responsive design** for all screen sizes
- **Offline-capable** with graceful degradation

### 🏆 Game Management
- **Host controls** (kick players, configure settings)
- **Game history** and player statistics
- **Multiple rounds** in the same room
- **Sound/vibration notifications**

## 🚀 Quick Start

### For Players
1. Visit https://granny-irl.vercel.app
2. Sign in with Google
3. Create or join a room with 6-digit code
4. Enable location permissions for tracking
5. Start playing!

### For Developers
```bash
git clone https://github.com/AdamHAwad/granny-irl.git
cd granny-irl
npm install
npm run dev  # Opens localhost:3000
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time + Storage)
- **Maps**: Leaflet + OpenStreetMap (zero cost)
- **Deployment**: Vercel (auto-deploy from GitHub)
- **Real-time**: Supabase subscriptions + polling fallback

## 📖 Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Complete development context
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Developer guide and patterns

## 🎯 Game Flow

### Original Mode (Classic Tag)
1. **Lobby Phase**: Players join room, host configures settings
2. **Headstart Phase**: Survivors get time to hide (5s-5min)
3. **Hunt Phase**: Killers track survivors on map (30s-30min)
4. **Victory**: Survivors win if they survive the timer, killers win if they eliminate all survivors

### Skillcheck Mode (Escape Challenge)
1. **Lobby Phase**: Host enables skillchecks and pins locations on map
2. **Headstart Phase**: Survivors hide while skillcheck positions are generated
3. **Skillcheck Phase**: Survivors complete minigames at designated locations
4. **Escape Phase**: Once timer expires OR all skillchecks are complete, escape area appears
5. **Victory**: Dead by Daylight-style - Killers win if they eliminate 75%+ of survivors, Survivors win if enough escape (individual escapes matter!)

## 📝 Configuration

Game hosts can customize:
- **Killer count**: 1-3 killers per game
- **Round length**: 30 seconds to 30 minutes
- **Headstart time**: 5 seconds to 5 minutes
- **Max players**: Up to 15 per room
- **Skillcheck settings** (optional):
  - Enable/disable skillcheck mode
  - Number of skillchecks (1-5)
  - Maximum distance from pinned location (100-1000m)
  - Interactive map location picker

## 🔒 Privacy

- Location data only shared during active games
- Automatic cleanup when games end
- No location tracking outside of gameplay
- Clear permission requests with explanations

## 🌟 Recent Updates (December 2025)

- ✅ **Non-invasive notification system** - Prompts only show once, then become background notifications
- ✅ **Robust error handling** - All critical actions have timeout protection
- ✅ **"I was caught" button fixes** - No more stuck states or multiple clicks required
- ✅ **Escape button improvements** - Single-click escapes with loading states
- ✅ **Game end detection fixes** - Properly handles escaped vs eliminated players
- ✅ **Local state tracking** - Prevents double skillcheck prompts
- ✅ **Dead by Daylight-style skillcheck system** with proximity detection
- ✅ **Escape area mechanics** with purple door markers
- ✅ **Interactive map location picker** for skillcheck placement
- ✅ **Dual win condition system** (original + escape modes)
- ✅ **Performance optimizations** for real-time gameplay
- ✅ **Mobile-friendly UI improvements** and touch controls

## 🔮 Upcoming Features

- **Killer Notifications**: Real-time alerts when skillchecks are completed
- **Heat Maps**: Movement density visualization
- **Trail History**: Player path tracking  
- **Mobile Apps**: Native iOS/Android versions
- **Spectator Mode**: Watch games after elimination

## 🐛 Known Issues

- GPS accuracy varies by device and environment
- Device compass may not work on all phones
- Free tier database can experience slowness during peak usage
- Location permissions must be granted for each game session

---

Built with ❤️ for outdoor gaming enthusiasts