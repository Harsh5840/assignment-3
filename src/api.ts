/**
 * api.ts
 * Handles fetching data from JSONPlaceholder API endpoints and merging them.
 * Implements error handling with specific error messages for network issues, timeouts, and data validation.
 */

import axios, { AxiosError } from 'axios';
import { User, Post, MergedPost, ApiResponse } from './types';

// Constants for API configuration
const BASE_URL = 'https://jsonplaceholder.typicode.com';
const USERS_ENDPOINT = `${BASE_URL}/users`;
const POSTS_ENDPOINT = `${BASE_URL}/posts`;
const REQUEST_TIMEOUT = 5000; // 5 seconds timeout

/**
 * Creates an axios instance with predefined timeout and headers
 * Why: Centralizing configuration ensures consistency and easy maintenance.
 * The 5-second timeout prevents the CLI from hanging indefinitely on network issues.
 */
const apiClient = axios.create({
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'API-Integration-CLI/1.0'
  }
});

/**
 * Fetches users from the JSONPlaceholder API
 * @returns Promise resolving to an array of User objects or error response
 */
async function fetchUsers(): Promise<ApiResponse<User[]>> {
  try {
    const response = await apiClient.get<User[]>(USERS_ENDPOINT);
    
    // Validate that response data is an array
    if (!Array.isArray(response.data)) {
      return {
        success: false,
        error: 'Malformed Data: Expected an array of users'
      };
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return handleApiError(error, 'fetching users');
  }
}

/**
 * Fetches posts from the JSONPlaceholder API
 * @returns Promise resolving to an array of Post objects or error response
 */
async function fetchPosts(): Promise<ApiResponse<Post[]>> {
  try {
    const response = await apiClient.get<Post[]>(POSTS_ENDPOINT);

    // Validate that response data is an array
    if (!Array.isArray(response.data)) {
      return {
        success: false,
        error: 'Malformed Data: Expected an array of posts'
      };
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return handleApiError(error, 'fetching posts');
  }
}

/**
 * Centralizes API error handling with specific error messages
 * Why: Provides a consistent way to handle different types of errors (network, timeout, 404, etc.)
 * with user-friendly messages instead of raw error objects.
 * 
 * @param error The error object from axios
 * @param operation Description of what operation was being performed
 * @returns Structured error response
 */
function handleApiError(error: unknown, operation: string): ApiResponse<never> {
  const axiosError = error as AxiosError;

  if (axiosError.code === 'ECONNABORTED') {
    return {
      success: false,
      error: `Network Error: Request timeout (${REQUEST_TIMEOUT}ms) while ${operation}`
    };
  }

  if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
    return {
      success: false,
      error: `Network Error: Unable to connect to API while ${operation}`
    };
  }

  if (axiosError.response?.status === 404) {
    return {
      success: false,
      error: `404 Error: Endpoint not found while ${operation}`
    };
  }

  if (axiosError.response?.status === 500) {
    return {
      success: false,
      error: `Server Error: API returned 500 while ${operation}`
    };
  }

  return {
    success: false,
    error: `Network Error: ${error instanceof Error ? error.message : 'Unknown error'} while ${operation}`
  };
}

/**
 * Merges Users and Posts data into a single MergedPost structure
 * Why: This transformation enriches posts with author names, making data more meaningful to users.
 * We map userId to author_name by creating a lookup object for O(1) access time.
 * 
 * @param users Array of User objects
 * @param posts Array of Post objects
 * @returns Array of MergedPost objects with author names
 */
function mergePosts(users: User[], posts: Post[]): MergedPost[] {
  // Create a lookup map for O(1) access: userId -> User
  const userMap = new Map<number, User>();
  for (const user of users) {
    userMap.set(user.id, user);
  }

  // Transform posts by adding author_name from the user map
  return posts.map(post => {
    const author = userMap.get(post.userId);
    return {
      id: post.id,
      title: post.title,
      body: post.body,
      userId: post.userId,
      author_name: author?.name || 'Unknown Author'
    };
  });
}

/**
 * Main function to fetch and merge data from both endpoints
 * Why: This orchestrates the entire data fetching and transformation pipeline.
 * It fetches users and posts in parallel for better performance, then merges them.
 * 
 * @returns Promise resolving to merged posts or error response
 */
export async function fetchAndMergeData(): Promise<ApiResponse<MergedPost[]>> {
  try {
    // Fetch users and posts in parallel for better performance
    const [usersResponse, postsResponse] = await Promise.all([
      fetchUsers(),
      fetchPosts()
    ]);

    // Check if both requests were successful
    if (!usersResponse.success || !usersResponse.data) {
      return {
        success: false,
        error: usersResponse.error || 'Failed to fetch users'
      };
    }

    if (!postsResponse.success || !postsResponse.data) {
      return {
        success: false,
        error: postsResponse.error || 'Failed to fetch posts'
      };
    }

    // Merge the data and return
    const mergedData = mergePosts(usersResponse.data, postsResponse.data);

    return {
      success: true,
      data: mergedData
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error during data fetch and merge: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
