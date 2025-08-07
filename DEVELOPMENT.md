# Granny IRL Development Guide

## Quick Context (December 2025)
- **Status**: Production-ready with hybrid optimization architecture and modern UI design
- **Tech Stack**: Next.js 14 + Supabase + Leaflet maps + TypeScript + Tailwind CSS
- **Live**: https://granny-irl.vercel.app
- **Repo**: https://github.com/AdamHAwad/granny-irl
- **Recent Achievement**: Solved location tracking vs action responsiveness loop with 3-tier optimization
- **Performance**: All actions complete within 5-6 seconds maximum with timeout protection

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
- Dead by Daylight-style skillcheck system
- Escape area mechanics with dual win conditions
- Interactive map location picker for hosts
- **NEW: Non-invasive notification system**
- **NEW: Robust error handling with timeout protection**
- **NEW: Local state tracking for immediate UI updates**

### 🔧 Known Technical Details
- **Supabase free tier**: Causes some slowness in transitions
- **Location updates**: 5-second frequency during games
- **Map implementation**: Leaflet + OpenStreetMap (no API costs)
- **Real-time**: Subscriptions + 2s polling fallback

### 🚧 Next Priority Features
1. **Killer Notifications** - Real-time alerts when skillchecks are completed
2. **Remove skillcheck penalties code** - Clean up deprecated timer extensions
3. **Heat Maps** - Player movement density tracking
4. **Trail History** - Path visualization (toggleable)
5. **Native Mobile Apps** - iOS/Android wrappers

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
1. **"I was caught" button stuck** → Fixed with timeout protection
2. **Game not ending properly** → Fixed checkGameEnd logic
3. **Double skillcheck prompts** → Fixed with local state tracking
4. **Multiple clicks required for escape** → Fixed with loading states
5. **Invasive prompts blocking gameplay** → Fixed with background notifications
6. **Slow transitions** → Supabase free tier latency (expected)
7. **Location not working** → Browser permissions
8. **Map not loading** → Network/Leaflet imports
9. **Column doesn't exist errors** → PostgreSQL case sensitivity
10. **Build failures** → React hook dependencies or TypeScript errors

### Debug Tools:
- **Console logs with emoji prefixes**: Filter by 🏁, 🚪, 🎯, 🏃, ❌, ✅
- **Host debug panel**: Manual controls for testing game mechanics
- Browser DevTools for network and performance
- Supabase dashboard for DB queries and real-time monitoring

### Key Debug Console Filters:
```javascript
// In browser console, filter by these:
🏁  // Game end detection logs
🚪  // Escape area related logs  
🎯  // Skillcheck completion logs
🏃  // Player escape attempts
❌  // Error messages
✅  // Success confirmations
```

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

## State Management Patterns

### Error Prevention:
```typescript
// Prevent multiple simultaneous actions
const [eliminating, setEliminating] = useState(false);
const [escaping, setEscaping] = useState(false);

// Track dismissed prompts
const [dismissedSkillcheckPrompts, setDismissedSkillcheckPrompts] = useState<Set<string>>(new Set());
const [dismissedEscapePrompt, setDismissedEscapePrompt] = useState(false);

// Local state for immediate updates
const [localCompletedSkillchecks, setLocalCompletedSkillchecks] = useState<Set<string>>(new Set());
```

### Timeout Protection:
```typescript
// All critical actions use this pattern
const actionPromise = someAsyncAction();
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Timeout')), 10000)
);
await Promise.race([actionPromise, timeoutPromise]);
```

---
**Updated**: December 2025 (Comprehensive Documentation)  
**Status**: Production-ready with refined UX and robust error handling  
**Next**: See CLAUDE.md for complete implementation details and future features