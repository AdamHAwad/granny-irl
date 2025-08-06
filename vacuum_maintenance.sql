-- Database Maintenance - Run this AFTER fix_security_issues.sql
-- This optimizes table statistics for better query performance

-- Vacuum and analyze for immediate performance improvements
VACUUM ANALYZE public.rooms;
VACUUM ANALYZE public.user_profiles;
VACUUM ANALYZE public.game_results;