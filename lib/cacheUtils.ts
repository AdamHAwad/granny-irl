/**
 * Cache utilities for Granny IRL
 * Provides centralized cache management to prevent stale data issues
 */

// Global cache reference (imported from gameService)
let globalQueryCache: Map<string, any> | null = null;

export function setGlobalCache(cache: Map<string, any>) {
  globalQueryCache = cache;
}

/**
 * Clear all cached data for a specific room
 * Use this when entering game pages to ensure fresh data
 */
export function clearRoomCache(roomCode: string) {
  if (!globalQueryCache) return;
  
  // Clear all cache entries related to this room
  const keysToDelete: string[] = [];
  
  for (const key of Array.from(globalQueryCache.keys())) {
    if (key.includes(roomCode) || key.startsWith(`room:${roomCode}`)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => globalQueryCache!.delete(key));
  
  console.log(`🧹 Cleared ${keysToDelete.length} cache entries for room ${roomCode}`);
}

/**
 * Clear all cache entries
 * Use this when experiencing data inconsistencies
 */
export function clearAllCache() {
  if (!globalQueryCache) return;
  
  const size = globalQueryCache.size;
  globalQueryCache.clear();
  
  console.log(`🧹 Cleared all ${size} cache entries`);
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  if (!globalQueryCache) return { size: 0, entries: [] };
  
  const entries = Array.from(globalQueryCache.entries()).map(([key, value]) => ({
    key,
    timestamp: value.timestamp,
    ttl: value.ttl,
    age: Date.now() - value.timestamp
  }));
  
  return {
    size: globalQueryCache.size,
    entries
  };
}