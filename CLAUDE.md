# Claude Development Context - Granny IRL

## Project Overview
**Granny IRL** is a web-based companion app for real-life outdoor tag games. Players use their phones to coordinate games with killers hunting survivors in the real world. Think "Friday the 13th" meets "Pokémon GO".

**Live URL**: https://granny-irl.vercel.app/

## Current Status: PRODUCTION READY ✅
- Fully functional multiplayer game coordination
- Real-time location tracking with interactive maps
- Complete game flow from lobby to results
- Mobile-optimized for outdoor gameplay
- All major features implemented and tested

## Technical Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Real-time, Storage)
- **Maps**: Leaflet + OpenStreetMap (free, no API keys)
- **Deployment**: Vercel (automatic from GitHub main branch)
- **Real-time**: Supabase subscriptions + 2-second polling fallback

## Database Schema (Supabase PostgreSQL)

### Tables:
1. **user_profiles**
   ```sql
   - uid (FK to auth.users)
   - display_name 
   - custom_username
   - profile_picture_url
   - created_at
   ```

2. **rooms**
   ```sql
   - id (6-digit string code)
   - host_uid
   - players (JSONB - Player objects)
   - settings (JSONB - RoomSettings)
   - status ('waiting' | 'headstart' | 'active' | 'finished')
   - created_at, headstart_started_at, game_started_at, game_ended_at
   ```

3. **game_results**
   ```sql
   - room_id
   - winners ('killers' | 'survivors')
   - elimination_order (array of UIDs)
   - game_started_at, game_ended_at
   - final_players (JSONB snapshot)
   ```

## Core Features Implemented

### 1. Authentication & Profiles
- Google OAuth via Supabase Auth
- Custom usernames and profile pictures
- Profile picture upload to Supabase Storage
- Edit profile functionality with existing data

### 2. Room Management
- 6-digit room codes for easy sharing
- Real-time player list updates
- Host controls (kick players, start game)
- Room settings: killers (1-3), round length (30s-30min), headstart (5s-5min)
- Rooms persist for multiple games

### 3. Game Flow
- **Waiting**: Players join, host configures
- **Headstart**: Survivors hide (configurable time)
- **Active**: Hunt begins, real-time tracking
- **Finished**: Shows results and stats

### 4. Location Features
- Permission request system with privacy info
- Real-time GPS tracking (5-second updates)
- Interactive OpenStreetMap integration
- Proximity detection (<100m triggers arrow)
- Directional arrow pointing to nearest survivor
- Auto-cleanup on game end

### 5. Map Features
- Pinch-to-zoom, drag-to-pan
- Player markers with profile pictures
- Color coding (red=killers, blue=survivors)
- Distance calculations and display
- Auto-fit bounds to show all players
- Accuracy circles for GPS precision

### 6. Game Mechanics
- Random killer assignment
- Self-elimination button ("I Was Caught!")
- Automatic win detection
- Sound/vibration notifications
- Game history tracking
- Player statistics

## File Structure

### Core Services
```
/lib/
├── supabase.ts          # Supabase client config
├── gameService.ts       # Game logic, room management
├── userService.ts       # Profile management
└── locationService.ts   # GPS tracking, calculations
```

### Key Components
```
/components/
├── InteractiveGameMap.tsx    # Leaflet map implementation
├── ProximityArrow.tsx        # Directional tracking arrow
├── LocationPermissionModal.tsx # Privacy-focused permissions
├── ProfileSetup.tsx          # User profile editor
└── [auth/room/game components]
```

### Pages (App Router)
```
/app/
├── page.tsx                  # Home/profile/room list
├── room/[roomCode]/page.tsx  # Room lobby
├── game/[roomCode]/page.tsx  # Active gameplay
├── results/[roomCode]/page.tsx # Game results
└── history/page.tsx          # Player statistics
```

## Environment Setup
```env
NEXT_PUBLIC_SUPABASE_URL=https://vyybwuzpwvrwpbtoreoz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-key]
```

## Key Implementation Details

### Location Tracking
- Uses browser Geolocation API
- High-frequency mode during games (5s updates)
- Handles iOS device orientation permissions
- Distance/bearing calculations using Haversine formula

### Real-time Updates
- Primary: Supabase real-time subscriptions
- Fallback: 2-second polling (reliability)
- Resilient error handling for transitions

### Performance Optimizations
- Dynamic imports for Leaflet (SSR compatibility)
- Debounced location updates
- Efficient player filtering
- Smart map bounds calculation

## Recent Bug Fixes
1. **Profile pictures not showing in edit modal** - Fixed by passing existing profile data
2. **"Room not found" during transitions** - Added 5-second grace period
3. **Elimination button stuck** - Needs proper state management (reverted)
4. **Map profile pictures as capsules** - Fixed with proper circular cropping

## Known Limitations
- Free tier slowness (Supabase database operations)
- Compass may not work on all devices
- Location accuracy depends on device GPS

## Pending Features
1. **Game Boundaries** - Host draws play area on map
2. **Heat Maps** - Show player movement density
3. **Trail History** - Track player paths
4. **Mobile Apps** - Native iOS/Android wrappers

## Development Workflow
```bash
npm run dev          # Local development
npm run build        # Production build
npm run lint         # Code linting
git push            # Auto-deploy to Vercel
```

## Testing Credentials
- Use any Google account for authentication
- Test room codes: Create new or join existing
- Location testing: Enable GPS on device

## Deployment
- **Production**: https://granny-irl.vercel.app
- **GitHub**: https://github.com/AdamHAwad/granny-irl
- **Auto-deploy**: Push to main branch
- **Build time**: ~2-3 minutes

## Quick Start for New Features
1. Check this file for context
2. Review `/types/game.ts` for data structures
3. Use existing services in `/lib/`
4. Follow component patterns
5. Test with 5s/30s game settings

---
**Last Updated**: Current session
**Status**: Production-ready with active development</content>
</invoke>