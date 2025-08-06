-- Fix RLS Performance Issues
-- Replace auth.uid() with (select auth.uid()) to prevent re-evaluation for each row
-- This will dramatically improve query performance

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view game results" ON public.game_results;
DROP POLICY IF EXISTS "Authenticated users can insert game results" ON public.game_results;
DROP POLICY IF EXISTS "Anyone authenticated can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone authenticated can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Anyone authenticated can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Room hosts can delete rooms" ON public.rooms;

-- Recreate user_profiles policies with optimized auth checks
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT
    USING (uid = (select auth.uid()));

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE
    USING (uid = (select auth.uid()));

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
    FOR INSERT
    WITH CHECK (uid = (select auth.uid()));

-- Recreate game_results policies with optimized auth checks
CREATE POLICY "Authenticated users can view game results" ON public.game_results
    FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert game results" ON public.game_results
    FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Recreate rooms policies with optimized auth checks
CREATE POLICY "Anyone authenticated can view rooms" ON public.rooms
    FOR SELECT
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Anyone authenticated can create rooms" ON public.rooms
    FOR INSERT
    WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Anyone authenticated can update rooms" ON public.rooms
    FOR UPDATE
    USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Room hosts can delete rooms" ON public.rooms
    FOR DELETE
    USING (host_uid = (select auth.uid()));

-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_rooms_id ON public.rooms(id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_host_uid ON public.rooms(host_uid);
CREATE INDEX IF NOT EXISTS idx_game_results_room_id ON public.game_results(room_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_uid ON public.user_profiles(uid);

-- Analyze tables to update statistics
ANALYZE public.rooms;
ANALYZE public.user_profiles;
ANALYZE public.game_results;