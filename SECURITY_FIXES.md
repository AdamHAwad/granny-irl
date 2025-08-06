# Security Fixes for Granny IRL

## Overview
This document addresses the security warnings from Supabase Security Advisor and implements performance improvements for the "I was caught" button functionality.

## Security Issues Fixed

### 1. Function Search Path Mutable Warnings ✅
**Issue**: All SECURITY DEFINER functions were missing explicit search_path settings
**Risk**: Potential privilege escalation attacks
**Fix**: Added `SET search_path = public, pg_temp` to all functions

### 2. New Secure "I was caught" Handler ✅
**Issue**: "I was caught" button required refresh to work properly
**Risk**: Poor user experience and potential race conditions
**Fix**: Created `handle_player_caught` function with explicit locking

## Required Actions

### Step 1: Deploy Security Fixes (CRITICAL)
Run this SQL script in your Supabase SQL Editor:

```sql
-- Copy the entire contents of fix_security_issues.sql and run it
```

This will:
- Fix all Function Search Path Mutable warnings (4 functions)
- Add the new secure `handle_player_caught` function
- Improve "I was caught" button reliability
- Add additional security hardening

### Step 2: Manual Supabase Dashboard Settings
These require manual configuration in your Supabase Dashboard:

#### A) Fix Auth OTP Long Expiry Warning
1. Go to **Authentication > Settings > Auth Providers**
2. Find the OTP configuration
3. Change expiry time from default (3600 seconds) to **300 seconds** (5 minutes)
4. Click "Save"

#### B) Enable Leaked Password Protection
1. Go to **Authentication > Settings > Security**
2. Find "Leaked password protection"
3. **Enable** this setting
4. Click "Save"

## Technical Details

### Functions Updated with Secure Search Path:
1. `eliminate_player_fast` - Player elimination
2. `update_player_location_fast` - Location tracking  
3. `complete_skillcheck_fast` - Skillcheck completion
4. `mark_player_escaped_fast` - Escape area mechanics

### New Function Added:
- `handle_player_caught` - Secure "I was caught" processing with race condition prevention

### Code Changes Made:
- Updated `eliminatePlayer` in `gameService.ts` to use new secure function first
- Added proper error handling and fallbacks
- Improved transaction safety with explicit table locking

## Expected Results

### Performance Improvements:
- **"I was caught" button**: Should work instantly without refresh
- **Database operations**: Faster response times
- **Security warnings**: All resolved in Supabase dashboard

### Security Improvements:
- **Function security**: Protected against privilege escalation
- **OTP security**: Shorter expiry windows reduce attack window
- **Password security**: Protection against known breached passwords

## Testing Checklist

After deploying the SQL fixes:

1. **"I was caught" button**:
   - [ ] Works on first click (no refresh needed)
   - [ ] Updates game state immediately
   - [ ] Shows proper elimination messages

2. **Supabase Dashboard**:
   - [ ] Security Advisor shows 0 critical warnings
   - [ ] Performance metrics improved
   - [ ] All functions have secure search paths

3. **General gameplay**:
   - [ ] Location updates work smoothly
   - [ ] Skillchecks complete properly
   - [ ] Escape areas function correctly
   - [ ] Game end detection works

## Rollback Plan

If issues occur after deployment:

1. **Function issues**: Previous functions will still work as fallbacks
2. **Auth issues**: OTP and password settings can be reverted in dashboard
3. **Database issues**: All changes are additive and backward compatible

## Monitoring

After deployment, monitor:
- Supabase Dashboard > Database > Query Performance
- Network tab for API response times
- User feedback on "I was caught" button performance

## Next Steps (Optional)

Consider these additional security enhancements:
- Enable Row Level Security audit logging
- Set up database query monitoring
- Implement rate limiting on API endpoints
- Add input validation functions

---

**IMPORTANT**: Run the SQL script first, then update the dashboard settings. The code changes are already deployed and will automatically use the new secure functions once they're available.