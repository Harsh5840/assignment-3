/**
 * types.ts
 * Defines TypeScript interfaces for API responses and the merged data structure.
 * Using strict typing ensures type safety throughout the application.
 */

/**
 * User interface from JSONPlaceholder API
 * Represents a user entity with contact and company information
 */
export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  phone?: string;
  website?: string;
  company?: {
    name: string;
  };
}

/**
 * Post interface from JSONPlaceholder API
 * Represents a post entity with basic content
 */
export interface Post { 
  userId: number;
  id: number;
  title: string;
  body: string;
}

/**
 * MergedPost interface - the main data structure delivered to the user
 * Why: We merge User information into Posts to display author_name instead of raw userId.
 * This provides a better user experience and more meaningful data representation.
 */
export interface MergedPost {
  id: number;
  title: string;
  body: string;
  userId: number;
  author_name: string; // Derived from User.name using userId
}

/**
 * Cache data structure
 * Why: We store the merged posts along with a timestamp to implement cache expiry logic.
 * This allows us to check if the cache is stale (older than 1 hour) and refetch if necessary.
 */
export interface CacheData {
  posts: MergedPost[];
  timestamp: number; // Unix timestamp in milliseconds
}

/**
 * API Response wrapper for error handling
 * Why: Standardizes response structure across the application for consistent error handling
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
