/**
 * cache.ts
 * Handles reading and writing cached data to a local JSON file.
 * Implements cache expiry logic (1 hour) to determine when to refresh data.
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { CacheData, MergedPost, ApiResponse } from './types';

// Cache file location in the current working directory
const CACHE_FILE_PATH = path.join(process.cwd(), 'data_cache.json');

// Cache expiry time: 1 hour in milliseconds
const CACHE_EXPIRY_TIME = 60 * 60 * 1000; // 3,600,000 ms

/**
 * Checks if the cache file exists and is still valid (not expired)
 * Why: This determines whether we should use cached data or fetch fresh data.
 * A cache older than 1 hour is considered stale and requires refreshing.
 * 
 * @returns boolean - true if cache exists and is valid, false otherwise
 */
export function isCacheValid(): boolean {
  try {
    // Check if cache file exists
    if (!existsSync(CACHE_FILE_PATH)) {
      return false;
    }

    // Read cache file synchronously for validity check
    // Why: We need to know validity before async operations, so sync read is appropriate here
    const cacheData = JSON.parse(
      require('fs').readFileSync(CACHE_FILE_PATH, 'utf-8')
    ) as CacheData;

    // Check if timestamp exists and cache is not expired
    if (!cacheData.timestamp) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - cacheData.timestamp;

    // Return true if cache is younger than 1 hour
    return cacheAge < CACHE_EXPIRY_TIME;
  } catch (error) {
    // If any error occurs while checking cache validity, treat it as invalid
    return false;
  }
}

/**
 * Reads cached data from the local JSON file
 * Why: This allows us to reuse previously fetched data when the cache is still valid,
 * reducing API calls and improving response time.
 * 
 * @returns Promise resolving to cached posts or error response
 */
export async function readCache(): Promise<ApiResponse<MergedPost[]>> {
  try {
    const data = await readFile(CACHE_FILE_PATH, 'utf-8');
    const cacheData = JSON.parse(data) as CacheData;

    // Validate that cache has the expected structure
    if (!Array.isArray(cacheData.posts)) {
      return {
        success: false,
        error: 'Malformed cache: posts array not found'
      };
    }

    return {
      success: true,
      data: cacheData.posts
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read cache: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Writes merged posts data to the local cache file with a timestamp
 * Why: Storing data with a timestamp allows us to implement cache expiry logic.
 * This ensures we can serve data quickly on subsequent requests without hitting the API.
 * 
 * @param posts Array of merged posts to cache
 * @returns Promise resolving to success or error response
 */
export async function writeCache(posts: MergedPost[]): Promise<ApiResponse<void>> {
  try {
    const cacheData: CacheData = {
      posts,
      timestamp: Date.now()
    };

    // Write cache file with formatted JSON for readability
    // Why: Pretty-printing makes debugging easier and doesn't significantly affect file size
    await writeFile(
      CACHE_FILE_PATH,
      JSON.stringify(cacheData, null, 2),
      'utf-8'
    );

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write cache: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Deletes the cache file (useful for manual cache clearing)
 * Why: Provides a way for users to force a refresh by deleting stale cache.
 * 
 * @returns Promise resolving to success or error response
 */
export async function clearCache(): Promise<ApiResponse<void>> {
  try {
    if (existsSync(CACHE_FILE_PATH)) {
      const { unlink } = await import('fs/promises');
      await unlink(CACHE_FILE_PATH);
    }

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Gets the cache file path (useful for logging and debugging)
 * @returns string - absolute path to cache file
 */
export function getCacheFilePath(): string {
  return CACHE_FILE_PATH;
}

/**
 * Gets the remaining cache lifetime in seconds
 * Why: Helpful for debugging and monitoring cache status
 * 
 * @returns number - seconds remaining until cache expires, or 0 if expired
 */
export function getCacheRemainingTime(): number {
  try {
    if (!existsSync(CACHE_FILE_PATH)) {
      return 0;
    }

    const cacheData = JSON.parse(
      require('fs').readFileSync(CACHE_FILE_PATH, 'utf-8')
    ) as CacheData;

    if (!cacheData.timestamp) {
      return 0;
    }

    const now = Date.now();
    const cacheAge = now - cacheData.timestamp;
    const remainingTime = Math.max(0, CACHE_EXPIRY_TIME - cacheAge);

    return Math.floor(remainingTime / 1000);
  } catch {
    return 0;
  }
}
