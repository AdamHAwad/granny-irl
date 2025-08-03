# Granny IRL Development Guide

## Quick Context
- **Production-ready** real-life tag game app
- **Tech Stack**: Next.js 14 + Supabase + Leaflet maps
- **Live**: https://granny-irl.vercel.app
- **Repo**: https://github.com/AdamHAwad/granny-irl

## Branching Strategy

### Branch Structure:
- **`main`** - Production (auto-deploys to Vercel)
- **`development`** - Integration branch for testing
- **`feature/*`** - Individual feature development

### Quick Workflow:
```bash
# For new features
git checkout -b feature/your-feature
# Work, commit, push to main directly (current practice)

# For production deploy
git push origin main  # Auto-deploys
```

## Current Implementation Status

### ✅ Core Features Complete
- Authentication (Google OAuth)
- Room management (6-digit codes)
- Real-time gameplay with location tracking
- Interactive OpenStreetMap integration
- Proximity detection and directional arrows
- Game history and player statistics
- Mobile-optimized responsive design
- **NEW: Dead by Daylight-style skillcheck system**
- **NEW: Escape area mechanics with dual win conditions**
- **NEW: Interactive map location picker for hosts**

### 🔧 Known Technical Details
- **Supabase free tier**: Causes some slowness in transitions
- **Location updates**: 5-second frequency during games
- **Map implementation**: Leaflet + OpenStreetMap (no API costs)
- **Real-time**: Subscriptions + 2s polling fallback

### 🚧 Next Priority Features
1. **Remove skillcheck penalties code** - Clean up deprecated timer extensions
2. **Heat Maps** - Player movement density tracking
3. **Trail History** - Path visualization (toggleable)
4. **Native Mobile Apps** - iOS/Android wrappers

### 🎯 New Game Modes
- **Original Mode**: Classic timer-based tag game
- **Skillcheck Mode**: Complete minigames → escape area appears → DBD-style win conditions (75% elimination rate)

## Quick Development Setup

### Local Environment:
```bash
git clone https://github.com/AdamHAwad/granny-irl.git
cd granny-irl
npm install
npm run dev  # localhost:3000
```

### Essential Commands:
```bash
npm run build     # Test production build
npm run lint      # Check code quality
git push         # Auto-deploy to production
```

## Code Architecture

### File Structure:
```
/lib/               # Business logic services
├── gameService.ts  # Room/game state management
├── userService.ts  # Profile/auth operations
└── locationService.ts # GPS tracking utilities

/components/        # Reusable UI components
├── InteractiveGameMap.tsx # Leaflet map implementation
├── ProximityArrow.tsx     # Directional tracking
└── [others...]

/app/              # Next.js App Router pages
├── page.tsx       # Home/profile
├── room/[code]/   # Room lobby
├── game/[code]/   # Active gameplay
└── results/[code] # Game results
```

### Key Patterns:
- **Services handle all business logic**
- **Components focus on UI/UX**
- **Real-time via Supabase subscriptions**
- **Mobile-first responsive design**

## Testing Strategy

### Quick Test Setup:
- Use 5s headstart, 30s rounds
- Test with multiple browser tabs
- Enable GPS permissions
- Check console for debug logs

### Critical Test Cases:
- Room creation/joining with skillcheck map picker
- Location permission flow
- Game state transitions (headstart → active → escape)
- Player elimination vs escape mechanics
- Map interactions and proximity detection
- Skillcheck minigame completion
- Escape area appearance and victory conditions

## Debugging Guide

### Common Issues:
1. **Slow transitions** → Supabase free tier latency
2. **Location not working** → Browser permissions
3. **Map not loading** → Network/Leaflet imports
4. **Profile pics missing** → Supabase storage policies
5. **Skillchecks using host GPS** → Check pinned location reference
6. **Escape area not appearing** → Run SQL migration in Supabase
7. **Column doesn't exist errors** → PostgreSQL case sensitivity
8. **Build failures** → React hook dependencies or unescaped strings

### Debug Tools:
- Console logs throughout services
- Browser DevTools for network
- Supabase dashboard for DB queries

## Performance Notes

### Current Optimizations:
- Dynamic imports for Leaflet (SSR compatibility)
- High-frequency location only during games
- Efficient player filtering and map bounds
- Graceful degradation for offline/low-GPS

### Known Limitations:
- Free tier causes 2-5s delays in database operations
- Compass may not work on all devices
- Location accuracy varies by device

## Database Setup

### Required SQL Migration:
```sql
-- Run ONCE in Supabase SQL Editor for escape area support
ALTER TABLE rooms 
ADD COLUMN escapeArea JSONB,
ADD COLUMN allSkillchecksCompleted BOOLEAN DEFAULT false;
```

### Schema Notes:
- Use lowercase column names: `skillcheckcenterlocation`
- JSONB for complex objects: players, skillchecks, escapeArea
- Players now include: hasEscaped, escapedAt fields

---
**Updated**: August 2025 (Escape Area System)  
**Status**: Production-ready with dual game modes  
**Next**: See CLAUDE.md for complete implementation details