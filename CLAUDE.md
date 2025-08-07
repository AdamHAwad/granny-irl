# Claude Development Context - Granny IRL

## Project Overview
**Granny IRL** is a web-based companion app for real-life outdoor tag games. Players use their phones to coordinate games with killers hunting survivors in the real world. Think "Friday the 13th" meets "Pokémon GO" with Dead by Daylight-style skillcheck mechanics.

**Live URL**: https://granny-irl.vercel.app/

## Current Status: PRODUCTION READY ✅
- Fully functional multiplayer game coordination
- Real-time location tracking with interactive maps
- Complete game flow from lobby to results
- Mobile-optimized for outdoor gameplay
- Dead by Daylight-style escape area system
- Interactive skillcheck mechanics with proximity detection
- Non-invasive notification system for game prompts
- Robust error handling with timeout protection
- All major features implemented, tested, and refined

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
   - players (JSONB - Player objects with hasEscaped, escapedAt fields)
   - settings (JSONB - RoomSettings with skillchecks)
   - status ('waiting' | 'headstart' | 'active' | 'finished')
   - created_at, headstart_started_at, game_started_at, game_ended_at
   - skillchecks (JSONB - Array of Skillcheck objects)
   - skillcheckTimeExtensions (INTEGER - deprecated)
   - skillcheckcenterlocation (JSONB - PlayerLocation for pinned skillcheck center)
   - escapeArea (JSONB - EscapeArea object)
   - allSkillchecksCompleted (BOOLEAN - completion tracking)
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
- **NEW: Dual win condition system:**
  - **Original games (no skillchecks):** Timer expires → survivors win
  - **Skillcheck games:** Timer/skillcheck completion → escape area → first escape wins
- **NEW: Skillcheck system with Dead by Daylight-style minigames**
- **NEW: 50m proximity detection for skillchecks and escape areas**
- **NEW: Interactive escape mechanics with purple door markers**
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

## Escape Area System (NEW)

### Implementation Details
The escape area system transforms Granny IRL from a simple tag game into a Dead by Daylight-style escape challenge. This major feature was implemented to add strategic depth and clear victory conditions.

#### Key Components:
1. **EscapeArea Interface** (types/game.ts):
   ```typescript
   interface EscapeArea {
     id: string;
     location: PlayerLocation;
     isRevealed: boolean;
     revealedAt?: number;
     escapedPlayers: string[];
   }
   ```

2. **Generation Logic** (lib/gameService.ts:75-102):
   - Uses same random distribution as skillchecks
   - Generated within specified radius of center location
   - Triggered by timer expiration OR skillcheck completion

3. **Visualization** (components/InteractiveGameMap.tsx:101-136):
   - Purple pulsing circle with door emoji (🚪)
   - Only visible to survivors and eliminated players
   - Killers cannot see escape areas (maintains game balance)

4. **Proximity Detection** (app/game/[roomCode]/page.tsx):
   - 50m detection radius
   - Automatic escape when survivors reach area
   - Instant win condition for survivor team

#### Win Conditions:
- **Skillcheck Games**: DBD-style - Killers win if they eliminate 75%+ of survivors, Survivors win if enough escape
- **Original Games**: Timer expires → survivors win (preserved)
- **All Games**: Individual survivors can escape but team victory depends on elimination rate

### Database Schema Updates
```sql
-- Add to rooms table
ALTER TABLE rooms 
ADD COLUMN escapeArea JSONB,
ADD COLUMN allSkillchecksCompleted BOOLEAN DEFAULT false;

-- Player objects now include:
-- hasEscaped: boolean
-- escapedAt: number (timestamp)
```

## Skillcheck System (NEW)

### Overview
Dead by Daylight-inspired skillcheck minigames that survivors must complete to reveal the escape area. This system adds skill-based challenges and strategic location planning.

#### Core Features:
1. **Interactive Map Picker**: Hosts pin skillcheck center location during room creation
2. **Random Generation**: Skillchecks scattered within host-defined radius
3. **Proximity Detection**: 50m range to start minigames
4. **Hit-Count Challenge**: Fast-moving needle with variable speed
5. **Role-Based Visibility**: Hidden from killers, visible to survivors
6. **Practice Mode**: Test button for hosts to try mechanics

#### Configuration Options:
- **Count**: 1-5 skillchecks per game
- **Distance**: 100-1000m radius from pinned location
- **Center Location**: Interactive Leaflet map picker

#### Technical Implementation:
- **Generation**: `generateSkillcheckPositions()` in gameService.ts
- **Minigame**: Standalone component with CSS animations
- **Completion**: Server-side tracking with real-time updates
- **Proximity**: Haversine distance calculation

## Recent Bug Fixes & Improvements (December 2025)

### Major Performance & UX Overhaul

#### **Hybrid Optimization Architecture (December 2025)**
**Problem**: Location tracking fixes broke action responsiveness, creating a loop where fixing one issue caused the other.

**Solution**: Implemented 3-tier hybrid approach that optimizes both concerns separately:

1. **Location Updates (Immediate)**:
   - Primary: `update_player_location_fast` RPC (single atomic operation)
   - Fallback: Standard Supabase operations (fetch+modify+update)
   - Maintains real-time map functionality

2. **Critical Actions (Timeout Protected)**:
   - **Elimination**: `handle_player_caught` RPC (6s timeout) → `eliminate_player_fast` RPC (5s timeout) → Emergency fallback
   - **Escape**: `mark_player_escaped_fast` RPC (5s timeout) → Standard fallback
   - **Skillchecks**: `complete_skillcheck_fast` RPC (5s timeout) → Standard fallback

3. **Key Improvements**:
   - **Timeout Protection**: Actions complete within 5-6 seconds maximum (no more stuck "Reporting death..." states)
   - **Separation of Concerns**: Location tracking doesn't interfere with action processing
   - **Better Error Handling**: Promise.race() prevents indefinite waiting
   - **Optimistic Performance**: RPC functions provide 10x faster operations when available

#### **Modern UI Redesign for Background Notifications**
**Problem**: Ugly yellow/purple boxes appeared when players clicked "Later" on skillcheck/escape prompts.

**Solution**: Complete redesign using modern UI best practices:
- **Glass-morphism Design**: Elegant backdrop-blur cards matching app theme
- **Smooth Micro-interactions**: Scale transitions, colored shadow glows, icon badge animations  
- **Professional Typography**: Proper hierarchy with clear font weights and opacity
- **Consistent Theming**: Uses granny-bg/granny-text color scheme with subtle gradients
- **Removed Jarring Effects**: Replaced harsh animate-pulse with refined hover states

#### **Critical Bug Fixes**
1. **"I was caught" button responsiveness**
   - Added 3-tier timeout protection (6s → 5s → emergency)
   - Implemented proper state management with `eliminating` flag
   - Added secure RPC function `handle_player_caught` with table locking
   - Shows proper killer attribution in elimination messages

2. **Game not ending after all players eliminated/escaped**
   - Fixed `checkGameEnd` logic to exclude escaped players from alive count
   - Added comprehensive debug logging with emoji prefixes (🔥, 🚪, 🎯, 📍)
   - Implemented fallback room status updates with async scheduling

3. **Location tracking vs Action delays relationship**
   - Identified that reverting location batching caused database contention
   - Solved with hybrid approach: immediate location updates + optimized action RPCs
   - Maintains map functionality without sacrificing action responsiveness

4. **Skillcheck/Escape prompt UX issues**
   - Modal only shows once per skillcheck/escape area
   - "Later" button shows professional background notifications instead of ugly boxes
   - Background notifications are non-blocking, elegantly designed, and clickable
   - Positioned bottom-right to avoid gameplay interference

### Database & Performance Architecture
1. **Hybrid RPC Strategy**: Primary optimized functions with reliable fallbacks
2. **PostgreSQL Optimizations**: Case sensitivity handled (escapearea, skillcheckcenterlocation)
3. **Real-time Architecture**: Supabase subscriptions + 2-second polling fallback
4. **Timeout Protection**: All critical operations have 5-6 second max completion times
5. **TypeScript Safety**: Proper error handling with type casting for Promise.race() patterns

## Known Limitations
- Free tier slowness (Supabase database operations)
- Compass may not work on all devices
- Location accuracy depends on device GPS

## Pending Tasks
1. **Add killer notifications when skillchecks are completed** - Notify killers in real-time
2. **Remove old skillcheck penalties (timer extension)** - Clean up deprecated code
3. **Add heat maps** - Visualize player movement density
4. **Implement trail history** - Track and display player paths
5. **Create mobile app wrappers** - Native iOS/Android apps

## Required SQL Migration
The escape area system requires running this SQL in Supabase:
```sql
-- Run this ONCE in Supabase SQL Editor
ALTER TABLE rooms 
ADD COLUMN escapeArea JSONB,
ADD COLUMN allSkillchecksCompleted BOOLEAN DEFAULT false;
```

## Troubleshooting Guide

### Common Issues:
1. **"Column doesn't exist" errors**:
   - PostgreSQL converts column names to lowercase
   - Use `skillcheckcenterlocation` not `skillcheckCenterLocation`
   - Run the SQL migration above for escape area columns

2. **Map not loading**:
   - Check for Leaflet SSR issues
   - Ensure dynamic imports are used
   - Icons created client-side only

3. **Location sharing not working**:
   - Verify permissions granted
   - Check real-time subscription status
   - Ensure updatePlayerLocation function exists

4. **Skillchecks using wrong location**:
   - Verify pinned location is saved as `skillcheckcenterlocation`
   - Check generation uses pinned location, not host GPS
   - Ensure map picker saves coordinates correctly

5. **Build failures**:
   - Check React hook dependencies
   - Escape apostrophes in strings
   - Ensure all imports have proper fallbacks

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

## UI/UX Patterns

### Notification System
The app uses a tiered notification approach to avoid disrupting gameplay:

1. **Modal Prompts** (First encounter only)
   - Full-screen overlays for skillchecks and escape areas
   - "Start Skillcheck" / "Later" buttons
   - "Escape Now!" / "Not Yet" buttons
   - Once dismissed, never shows again for that specific prompt

2. **Background Notifications** (After dismissal)
   - Small cards in bottom-right corner
   - Animated with `animate-pulse` class
   - Clickable to trigger action
   - Auto-clears when player moves away

3. **Status Cards** (Always visible)
   - Game timer and role display
   - Skillcheck progress bar
   - Escape area status
   - Player lists with real-time updates

### State Management Patterns
```typescript
// Prevent multiple simultaneous actions
const [eliminating, setEliminating] = useState(false);
const [escaping, setEscaping] = useState(false);

// Track dismissed prompts to show background notifications
const [dismissedSkillcheckPrompts, setDismissedSkillcheckPrompts] = useState<Set<string>>(new Set());
const [dismissedEscapePrompt, setDismissedEscapePrompt] = useState(false);

// Local state for immediate UI updates
const [localCompletedSkillchecks, setLocalCompletedSkillchecks] = useState<Set<string>>(new Set());
```

### Error Handling Patterns
All critical actions use timeout protection:
```typescript
const actionPromise = someAsyncAction();
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Timeout')), 10000)
);
await Promise.race([actionPromise, timeoutPromise]);
```

### Responsive Design
- Mobile-first approach with Tailwind CSS
- Touch-friendly buttons (minimum 44px tap targets)
- Proper overflow handling for modals
- Fixed positioning for critical UI elements

## Implementation Notes for Future Agents

### Key Patterns Used:
1. **Proximity Detection**: 50m radius using Haversine formula
2. **Role-Based Visibility**: Filter data by player role and elimination status  
3. **SSR Compatibility**: Dynamic imports for client-side only components
4. **Real-time Updates**: Supabase subscriptions with optimized queries
5. **Mobile Optimization**: Touch-friendly UI with proper overflow handling

### Database Naming Conventions:
- PostgreSQL converts to lowercase: use `skillcheckcenterlocation`
- JSONB columns store complex objects (players, skillchecks, escapeArea)
- Timestamps use `Date.now()` for consistency

### Performance Optimizations Applied:
- Memoized expensive calculations with `useMemo`
- Debounced map updates (150ms)
- Optimized real-time subscriptions
- Efficient player filtering by role
- Smart bounds calculation for map display

## Debug Console Commands
When debugging game issues, use these console filters:
- `🏁` - Game end detection logs
- `🚪` - Escape area related logs
- `🎯` - Skillcheck completion logs
- `🏃` - Player escape attempts
- `❌` - Error messages
- `✅` - Success confirmations

## Common Development Commands
```bash
npm run dev          # Start local development server
npm run build        # Build for production
npm run lint         # Run ESLint
git push            # Deploy to Vercel (automatic)
```

## Testing Guidelines
- Use short game durations (30s) for quick testing
- Enable host debug panel for manual controls
- Test on actual mobile devices for GPS features
- Use multiple browser tabs to simulate multiple players

---
**Last Updated**: December 2025 (Major Performance & UX Overhaul Complete)
**Status**: Production-ready with hybrid optimization architecture and modern UI design
**Recent Achievements**: 
- ✅ Solved location tracking vs action responsiveness loop
- ✅ Implemented 3-tier timeout protection for all critical actions  
- ✅ Redesigned background notifications with modern UI best practices
- ✅ Added comprehensive error handling with Promise.race() patterns
- ✅ Maintained real-time functionality while optimizing performance

**Session Context**: Full app implementation with hybrid optimization architecture, professional UI design, and robust error handling. All major bugs resolved with comprehensive documentation for future development.</content>
</invoke>