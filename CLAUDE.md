# Claude Development Context - Granny IRL

## Project Overview
**Granny IRL** is a web-based companion app for real-life tag games, similar to Friday the 13th video game mechanics. Players use their phones to coordinate outdoor tag games with killers and survivors.

**Live URL**: https://granny-irl.vercel.app/

## Current Status: MVP COMPLETE ✅
- Fully functional multiplayer game coordination
- Google authentication working
- Real-time room updates
- Game timer mechanics
- Results tracking
- Mobile-optimized UI
- Successfully deployed on Vercel

## Technical Stack
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL database, Auth, Real-time)
- **Authentication**: Google OAuth via Supabase Auth
- **Deployment**: Vercel
- **Real-time**: Supabase subscriptions + 2-second polling fallback

## Migration History
- **Started with**: Firebase (Auth + Realtime Database)
- **Migrated to**: Supabase (due to Firebase storage limitations)
- **Key challenge**: Field naming (camelCase → snake_case)

## Database Schema (Supabase PostgreSQL)

### Tables:
1. **user_profiles**
   - `uid` (FK to auth.users)
   - `display_name` 
   - `custom_username`
   - `profile_picture_url`
   - `created_at`

2. **rooms**
   - `id` (6-digit string code)
   - `host_uid`
   - `players` (JSONB object)
   - `settings` (JSONB object)
   - `status` ('waiting' | 'headstart' | 'active' | 'finished')
   - `created_at`, `headstart_started_at`, `game_started_at`, `game_ended_at`

3. **game_results**
   - `room_id`
   - `winners` ('killers' | 'survivors')
   - `elimination_order` (array of UIDs)
   - `game_started_at`, `game_ended_at`
   - `final_players` (JSONB snapshot)

## Key Features Implemented

### 1. Authentication Flow
- Google OAuth via Supabase
- Custom username/profile picture setup
- Persistent sessions

### 2. Room Management
- Create rooms with 6-digit codes
- Join existing rooms
- Real-time player list updates
- Room settings: killer count (1-3), round length, headstart time, max players

### 3. Game Flow
- **Waiting Phase**: Players join, host starts game
- **Headstart Phase**: Survivors get time to hide (5s-5min options)
- **Active Phase**: Round timer counts down (30s-30min options)
- **Results Phase**: Shows winners, elimination order, game stats

### 4. Game Mechanics
- Random killer assignment
- Self-reporting elimination ("I died" button)
- Automatic game end detection (time expires OR all survivors eliminated)
- Sound/vibration notifications

### 5. Testing Features
- 5-second headstart option
- 30-second round option
- Quick game cycles for development

## File Structure & Key Components

### Core Files:
- `/lib/supabase.ts` - Supabase client configuration
- `/lib/gameService.ts` - All game logic, room management, real-time subscriptions
- `/lib/userService.ts` - User profile management
- `/contexts/AuthContext.tsx` - Authentication state management
- `/types/game.ts` - TypeScript definitions

### Pages:
- `/app/page.tsx` - Home screen, profile setup, current room display
- `/app/room/[roomCode]/page.tsx` - Room lobby (waiting phase)
- `/app/game/[roomCode]/page.tsx` - Active game screen with timers
- `/app/results/[roomCode]/page.tsx` - Game results and statistics

### Components:
- `SignInButton.tsx` - Google OAuth sign-in
- `ProfileSetup.tsx` - Custom username/picture setup
- `CreateRoomModal.tsx` - Room creation with settings
- `JoinRoomModal.tsx` - Join room by code
- `CurrentRoom.tsx` - Shows active room on home screen

## Environment Variables (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=https://vyybwuzpwvrwpbtoreoz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5eWJ3dXpwd3Zyd3BidG9yZW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc2MjYsImV4cCI6MjA2OTY2MzYyNn0.3Hg9ercrUA7y4VRK973dIO99TMSIjzNOuWo2XSWHTJU
```

## Supabase Configuration
- **Project**: vyybwuzpwvrwpbtoreoz.supabase.co
- **Auth Redirect URLs**: 
  - `https://granny-irl.vercel.app/**`
  - `http://localhost:3000/**`
- **Site URL**: `https://granny-irl.vercel.app`

## Recent Fixes Applied
1. **Timer transition bug**: Fixed headstart → active phase transition
2. **Premature game ending**: Added 5-second grace period in `checkGameEnd`
3. **Auth redirect issue**: Hardcoded production domain for OAuth redirects
4. **Build errors**: Fixed TypeScript issues with user properties
5. **Removed old Firebase**: Cleaned up unused Firebase dependencies

## Known Issues & Limitations
- Real-time subscriptions sometimes unreliable (polling fallback in place)
- No major known bugs or limitations currently

## Recently Completed Features ✅
1. **Host kick feature** - Room hosts can remove players from rooms
2. **Profile picture uploads** - Full Supabase storage integration with cleanup
3. **Game history system** - Track player statistics and game records over time
4. **Multi-game room support** - Fixed "Results not found" error for rooms playing multiple games

## Future Development Priorities
1. **Mobile apps (iOS/Android)** - WebView wrapper app or React Native port
2. **Location sharing** - Killer sees all player locations, updates every 1 minute
3. **Improve real-time reliability** - Better WebSocket handling
4. **Add game modes** - Different rule variations
5. **Advanced features** - Spectator mode, custom rules, tournaments

### Feature Details:

#### Game History System ✅
- **Statistics tracking**: Games played, wins, losses, killer/survivor wins, avg placement
- **Detailed game records**: Role, outcome, placement, duration for each game
- **Performance metrics**: Win rate, elimination count, placement trends
- **Data source**: Uses existing `game_results` table for historical data
- **UI**: Accessible via "Game History" link on home page
- **Mobile optimized**: Responsive grid layout for stats and history
- **Multi-game support**: Fixed getGameResult() to handle rooms with multiple games

#### Host Kick Feature ✅
- Add "kick" button next to each player (only visible to host)
- Remove player from room.players object
- Force redirect kicked player to home screen
- Show notification "You've been removed from the room"

#### Profile Picture System ✅
- Create Supabase storage bucket for avatars
- Update upload endpoint in ProfileSetup component
- Handle image resizing/compression
- Add default avatar fallback
- Automatic cleanup of old profile pictures

#### Mobile App Strategy
- Option 1: WebView wrapper (quickest approach)
  - Use Capacitor or similar to wrap website
  - Add native features like push notifications
  - Maintain single codebase
- Option 2: React Native
  - Full native experience
  - Better performance
  - More development effort

#### Location Sharing
- Request location permissions during game
- Update player location every 60 seconds
- Store in rooms.players[uid].location
- Only visible to killers during active phase
- Privacy consideration: Auto-disable after game ends
- Show distance/direction indicators on killer's screen
- Show map (similar to Splashin app) with:
  - Survivors' profile pictures at their last pinged locations (1-minute updates)
  - Killer's profile picture in bold red circle (real-time updates)
  - Killer uses map to track survivors during hunt
  - Survivors cannot see map while alive (no unfair advantage)
  - Dead players can spectate the map to watch the action
- **Proximity Direction Feature** (like Find My app):
  - When killer is within ~50 meters of a survivor
  - Dynamic arrow appears pointing toward nearest survivor
  - Arrow updates in real-time using device compass/orientation
  - Uses Web APIs: Geolocation + DeviceOrientationEvent
  - Shows approximate distance (e.g., "~30m away")
  - Could pulse/change color as killer gets closer
  - Note: Requires HTTPS and device compass support

## Development Commands
```bash
npm run dev          # Local development
npm run build        # Production build
npm run lint         # Code linting
```

## Git Repository
- **GitHub**: https://github.com/AdamHAwad/granny-irl
- **Branch**: main
- **Latest commit**: OAuth debugging and fixes

## Deployment Notes
- Auto-deploys from GitHub main branch
- Build time: ~2-3 minutes
- Uses Vercel's Next.js optimization
- All environment variables configured

---

**Status**: Production-ready MVP with full game mechanics working. Ready for user testing and feature expansion.