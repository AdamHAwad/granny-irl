# Granny IRL - Technical Documentation

## What This App Does

**Granny IRL** is a web companion app for real-life tag games. Think "Friday the 13th" video game, but played outdoors with real people using their phones to coordinate.

### Game Flow:
1. **Setup**: Host creates a room with a 6-digit code, players join
2. **Role Assignment**: App randomly assigns killers (1-3) and survivors 
3. **Headstart**: Survivors get time to hide while killers wait
4. **Active Game**: Round timer starts, killers hunt survivors
5. **Self-Reporting**: Players hit "I died" when tagged in real life
6. **End Game**: Timer expires (survivors win) or all survivors eliminated (killers win)
7. **Results**: Shows winners, elimination order, and game stats

## Code Architecture

### Authentication (`/contexts/AuthContext.tsx`)
- Google OAuth through Supabase Auth
- Manages user sessions and profile state
- Handles sign-in/out and user data

### Game Logic (`/lib/gameService.ts`)
The heart of the app. Key functions:

**Room Management:**
- `createRoom()` - Generates 6-digit codes, initializes room
- `joinRoom()` - Adds players to existing rooms
- `leaveRoom()` - Removes players, deletes if host leaves

**Game Flow:**
- `startGame()` - Assigns roles, starts headstart timer
- `eliminatePlayer()` - Handles "I died" button presses
- `checkGameEnd()` - Determines winners, transitions to results
- `resetRoomForNewGame()` - Prepares room for next round

**Real-time Updates:**
- `subscribeToRoom()` - WebSocket + polling fallback for live updates

### Timer System
**Two-phase timing:**
1. **Headstart Phase**: `headstart_started_at` + duration = transition time
2. **Active Phase**: `game_started_at` + round length = game end time

**Client-side timers** update every second, **server-side timers** handle transitions.

### Database Design (Supabase PostgreSQL)

**rooms table:**
```sql
id TEXT PRIMARY KEY,           -- 6-digit room code
host_uid TEXT,                 -- User who created room  
players JSONB,                 -- Dynamic player object
settings JSONB,                -- Game configuration
status TEXT,                   -- 'waiting', 'headstart', 'active', 'finished'
created_at BIGINT,
headstart_started_at BIGINT,
game_started_at BIGINT,
game_ended_at BIGINT
```

**Players JSONB structure:**
```javascript
{
  "user123": {
    "uid": "user123",
    "displayName": "Adam",
    "profilePictureUrl": "https://...",
    "isAlive": true,
    "role": "killer", // or "survivor"
    "eliminatedAt": 1234567890,
    "eliminatedBy": "user456"
  }
}
```

### Real-time Updates Strategy
**Hybrid approach** for reliability:
1. **Primary**: Supabase real-time subscriptions
2. **Fallback**: 2-second polling when WebSocket fails
3. **Client-side**: 1-second timer updates for smooth countdowns

### Component Structure

**Pages:**
- `page.tsx` - Home screen, shows current room if in one
- `room/[code]/page.tsx` - Lobby for waiting phase
- `game/[code]/page.tsx` - Active game with timers and "I died" button
- `results/[code]/page.tsx` - Game results and statistics

**Key Components:**
- `CurrentRoom.tsx` - Shows active room on home screen
- `CreateRoomModal.tsx` - Room creation with settings
- `JoinRoomModal.tsx` - Join by room code
- `ProfileSetup.tsx` - Custom username/picture setup

### Error Handling & Edge Cases

**Room Management:**
- Duplicate room codes prevented with retry logic
- Host leaving deletes entire room
- Players can rejoin if they lose connection

**Game Flow:**
- Grace periods prevent timer race conditions
- Multiple elimination checks ensure game ends properly
- Auto-reset after games finish

**Real-time Issues:**
- Polling fallback when WebSocket fails
- Client-side validation with server-side authority
- Reconnection handling for lost connections

## Key Technical Decisions

### Why Supabase Over Firebase?
- **Firebase issue**: Storage upgrade required payment
- **Supabase benefits**: PostgreSQL (better queries), built-in auth, real-time
- **Migration challenge**: Field naming (camelCase → snake_case)

### Why Polling Fallback?
Real-time subscriptions can be unreliable on mobile networks outdoors. 2-second polling ensures the game works even with poor connectivity.

### Why 6-Digit Room Codes?
Easy to share verbally ("join room 4-3-7-2-1-5"), memorable, and 1 million possible combinations provide good uniqueness.

### Why Self-Reporting?
No GPS/proximity detection needed. Players physically tag each other and self-report. Builds trust and keeps the app simple.

## Security Considerations

**Row Level Security (RLS):**
- Users can only modify their own profiles
- Room hosts control game state
- Players can only eliminate themselves

**Authentication:**
- Google OAuth prevents fake accounts
- Supabase handles session management
- No sensitive data stored client-side

**Input Validation:**
- Room codes validated format and existence
- Player actions validated against game state
- Malformed requests gracefully handled

## Performance Optimizations

**Database:**
- JSONB for flexible player data without schema changes
- Indexed room codes for fast lookups
- Automatic cleanup of finished games

**Frontend:**
- Real-time updates only for necessary data
- Efficient re-renders with proper React dependencies
- Mobile-optimized UI with minimal JavaScript

**Network:**
- Polling only when real-time fails
- Debounced user actions
- Optimistic UI updates

## Development Workflow

**Local Development:**
```bash
npm run dev    # Starts on localhost:3000
```

**Environment Setup:**
- Copy `.env.local` with Supabase credentials
- Supabase redirects to localhost in development
- All features work identically to production

**Deployment:**
- Push to GitHub main branch
- Vercel auto-deploys in 2-3 minutes
- Environment variables configured in Vercel dashboard

**Testing:**
- Use 5-second headstart + 30-second rounds for quick testing
- Multiple browser tabs to simulate different players
- Console logs available for debugging

---

This documentation covers the complete technical implementation. The app is production-ready and successfully handles real-time multiplayer coordination for outdoor games.