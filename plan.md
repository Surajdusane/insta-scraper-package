/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/instagram/get-posts.ts
import type { InstagramPost, PostsResult, PostsError, PostsFetchOptions, PostsErrorCode } from "@/types/index"

// ✅ Configuration
const CONFIG = {
  INSTAGRAM_WEB_URL: "https://www.instagram.com",
  INSTAGRAM_API_BASE: "https://i.instagram.com/api/v1",
  MAX_RETRIES: 5,
  BASE_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 30000,
  REQUEST_TIMEOUT: 20000,
  DEFAULT_BATCH_SIZE: 12,
  DEFAULT_REQUEST_DELAY: 1500,
  DEFAULT_POST_COUNT: 3000,
};

/**
 * Fetch Instagram posts for a user with robust error handling
 */
export const getInstagramPosts = async (
  username: string,
  options: PostsFetchOptions = {}
): Promise<PostsResult> => {
  const {
    postCount = CONFIG.DEFAULT_POST_COUNT,
    batchSize = CONFIG.DEFAULT_BATCH_SIZE,
    requestDelay = CONFIG.DEFAULT_REQUEST_DELAY,
    onProgress,
    signal,
  } = options;

  // ✅ Validate inputs
  const validation = validateInputs(username, postCount);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: validation.error || 'Invalid input parameters',
        retryable: false,
      },
      posts: [],
    };
  }

  const cleanUsername = username.trim().toLowerCase();
  const collectedPosts: InstagramPost[] = [];
  let maxId: string | null = null;
  let requestsMade = 0;

  try {
    // ✅ Get authentication cookies
    const cookies = await getInstagramCookies();
    if (!cookies.success) {
      return { success: false, error: cookies.error, posts: [] };
    }

    const headers = buildInstagramHeaders(cookies.data);
    const endpoint = `${CONFIG.INSTAGRAM_API_BASE}/feed/user/${encodeURIComponent(cleanUsername)}/username/`;

    // ✅ Fetch posts in batches
    while (collectedPosts.length < postCount) {
      // Check for cancellation
      if (signal?.aborted) {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'Request cancelled',
            retryable: false,
          },
          posts: collectedPosts,
        };
      }

      // Rate limiting between requests
      if (requestsMade > 0) {
        await delay(requestDelay);
      }

      const url = `${endpoint}?count=${batchSize}${maxId ? `&max_id=${encodeURIComponent(maxId)}` : ''}`;
      
      const response = await fetchWithRetry(url, { headers, signal });
      
      // Handle API error response
      if (!response.success) {
        return {
          success: false,
          error: response.error,
          posts: collectedPosts, // Return partial results
        };
      }

      const data = response.data;

      // ✅ Validate response structure
      if (!data?.items || !Array.isArray(data.items)) {
        // Check for user not found
        if (data?.message?.includes('user not found') || data?.status === 'fail') {
          return {
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: `Username "${cleanUsername}" not found`,
              retryable: false,
            },
            posts: [],
          };
        }
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Unexpected API response format',
            retryable: true,
          },
          posts: collectedPosts,
        };
      }

      // ✅ Process posts
      for (const post of data.items) {
        if (collectedPosts.length >= postCount) break;
        
        const processed = processPost(post);
        if (processed) {
          collectedPosts.push(processed);
          
          // Report progress
          onProgress?.({
            fetched: collectedPosts.length,
            total: postCount,
            currentPost: processed,
          });
        }
      }

      // Check for pagination
      if (!data.next_max_id || data.more_available === false) {
        break;
      }

      maxId = data.next_max_id;
      requestsMade++;
    }

    return {
      success: true,
      posts: collectedPosts.slice(0, postCount),
      hasMore: !!maxId,
      nextMaxId: maxId || undefined,
    };

  } catch (error) {
    console.error('Instagram posts fetch failed:', error);
    
    return {
      success: false,
      error: {
        code: error instanceof Error && error.name === 'AbortError' 
          ? 'NETWORK_ERROR' 
          : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch posts',
        retryable: true,
        partialPosts: collectedPosts.length > 0 ? collectedPosts : undefined,
      },
      posts: collectedPosts,
    };
  }
};

/**
 * Validate function inputs
 */
function validateInputs(username: string, postCount: number): { valid: boolean; error?: string } {
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return { valid: false, error: 'Username must be a non-empty string' };
  }
  
  if (!Number.isInteger(postCount) || postCount <= 0) {
    return { valid: false, error: 'Post count must be between 1 and 200' };
  }
  
  return { valid: true };
}

/**
 * Get Instagram cookies with fallback domains
 */
async function getInstagramCookies(): Promise<{ success: true;  data: chrome.cookies.Cookie[] } | { success: false; error: PostsError }> {
  const domains = [
    CONFIG.INSTAGRAM_WEB_URL,
    "https://i.instagram.com",
    "https://instagram.com",
  ];

  for (const domain of domains) {
    try {
      const cookies = await chrome.cookies.getAll({ url: domain });
      if (cookies?.length > 0) {
        // Ensure we have critical cookies
        const hasCsrf = cookies.some(c => c.name === 'csrftoken');
        const hasSession = cookies.some(c => c.name === 'sessionid');
        
        if (hasCsrf && hasSession) {
          return { success: true,  data: cookies };
        }
      }
    } catch (err) {
      console.warn(`Failed to get cookies from ${domain}:`, err);
    }
  }

  return {
    success: false,
    error: {
      code: 'NO_COOKIES',
      message: 'Not authenticated with Instagram. Please log in and ensure cookies are accessible.',
      retryable: false,
    },
  };
}

/**
 * Build request headers with proper cookie handling
 */
function buildInstagramHeaders(cookies: chrome.cookies.Cookie[]): Record<string, string> {
  const cookieString = cookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  return {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/x-www-form-urlencoded',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'x-asbd-id': '129477',
    'x-csrftoken': cookies.find(c => c.name === 'csrftoken')?.value ?? '',
    'x-ig-app-id': '936619743392459',
    'x-ig-www-claim': cookies.find(c => c.name === 'x-ig-www-claim')?.value ?? '',
    'user-agent': 'Instagram 273.0.0.16.70 Android (30/11; 480dpi; 1080x2340; OnePlus; ONEPLUS A5010; OnePlus5; qcom; en_US; 458229237)',
    'cookie': cookieString,
    'x-ads-opt-out': '1',
    'x-bloks-is-panorama-enabled': 'true',
  };
}

/**
 * Process a single post with comprehensive media handling
 */
function processPost(post: any): InstagramPost | null {
  try {
    // Skip posts without media
    const hasVideo = post.video_versions?.length > 0;
    const hasImage = post.image_versions2?.candidates?.length > 0;
    const hasCarousel = Array.isArray(post.carousel_media) && post.carousel_media.length > 0;

    if (!hasVideo && !hasImage && !hasCarousel) {
      return null;
    }

    const downloadUrls: string[] = [];
    let mediaType: InstagramPost['media_type'] = 'image';
    let thumbnail: string | undefined;

    // Handle carousel posts
    if (hasCarousel) {
      mediaType = 'carousel';
      for (const item of post.carousel_media) {
        if (item.video_versions?.[0]?.url) {
          downloadUrls.push(item.video_versions[0].url);
          if (!thumbnail) thumbnail = item.image_versions2?.candidates?.[0]?.url;
        } else if (item.image_versions2?.candidates?.[0]?.url) {
          downloadUrls.push(item.image_versions2.candidates[0].url);
          if (!thumbnail) thumbnail = item.image_versions2.candidates[0].url;
        }
      }
    }
    // Handle single video
    else if (hasVideo) {
      mediaType = 'video';
      downloadUrls.push(post.video_versions[0].url);
      thumbnail = post.image_versions2?.candidates?.[0]?.url || post.thumbnail_url;
    }
    // Handle single image
    else if (hasImage) {
      mediaType = 'image';
      downloadUrls.push(post.image_versions2.candidates[0].url);
    }

    if (downloadUrls.length === 0) return null;

    // Generate post URL
    const postCode = post.code || post.shortcode;
    const postUrl = postCode 
      ? `https://www.instagram.com/${mediaType === 'video' ? 'reel' : 'p'}/${postCode}/`
      : null;

    return {
      id: String(post.id || post.pk || ''),
      code: postCode || '',
      date: Number(post.taken_at || post.timestamp || 0),
      media_type: mediaType,
      caption: post.caption?.text || post.caption || 'No caption available',
      views: Number(post.video_view_count || post.ig_play_count || post.view_count || 0),
      comments: Number(post.comment_count || 0),
      likes: Number(post.like_count || 0),
      duration: Number(post.video_duration || 0),
      url: postUrl,
      download_url: downloadUrls.length === 1 ? downloadUrls[0] : downloadUrls,
      thumbnail,
      carousel_count: mediaType === 'carousel' ? downloadUrls.length : undefined,
    };
  } catch (error) {
    console.error(`Error processing post ${post?.id || post?.pk || 'unknown'}:`, error);
    return null;
  }
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Merge signals if both provided
  const mergedSignal = signal 
    ? (() => {
        const merged = new AbortController();
        signal.addEventListener('abort', () => merged.abort());
        controller.signal.addEventListener('abort', () => merged.abort());
        return merged.signal;
      })()
    : controller.signal;

  try {
    const response = await fetch(url, { ...options, signal: mergedSignal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with exponential backoff retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = CONFIG.MAX_RETRIES,
  signal?: AbortSignal
): Promise<{ success: true;  data: any } | { success: false; error: PostsError }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, CONFIG.REQUEST_TIMEOUT, signal);

      // Handle HTTP errors
      if (!response.ok) {
        const error = await handleHttpError(response.status, response);
        if (!error.retryable || attempt === maxRetries - 1) {
          return { success: false, error };
        }
        // Retryable error - continue to next attempt
      } else {
        const json = await response.json();
        return { success: true,  data: json };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if retryable
      const isRetryable = 
        error instanceof Error &&
        (error.name === 'AbortError' ||
         error.message.includes('network') ||
         error.message.includes('Failed to fetch') ||
         error.message.includes('timeout'));

      if (!isRetryable || attempt === maxRetries - 1) {
        break;
      }
    }

    // Exponential backoff with jitter
    if (attempt < maxRetries - 1) {
      const baseDelay = CONFIG.BASE_RETRY_DELAY * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay + jitter, CONFIG.MAX_RETRY_DELAY);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: {
      code: 'NETWORK_ERROR',
      message: lastError?.message || 'Request failed after all retries',
      retryable: false,
    },
  };
}

/**
 * Handle specific HTTP status codes
 */
async function handleHttpError(status: number, response: Response): Promise<PostsError> {
  let message = `HTTP error: ${status}`;
  let code: PostsErrorCode = 'UNKNOWN_ERROR';
  let retryable = status >= 500;

  // Try to parse error body
  try {
    const text = await response.text();
    if (text) {
      message += ` - ${text.slice(0, 200)}`;
    }
  } catch {
    // Ignore parse errors
  }

  switch (status) {
    case 404:
      code = 'USER_NOT_FOUND';
      message = 'User not found';
      retryable = false;
      break;
    case 401:
    case 403:
      code = 'AUTH_FAILED';
      message = 'Authentication failed. Cookies may be expired.';
      retryable = false;
      break;
    case 429:
      code = 'RATE_LIMITED';
      message = 'Rate limit exceeded. Please wait before retrying.';
      retryable = true;
      break;
    case 400:
      code = 'INVALID_INPUT';
      retryable = false;
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      code = 'NETWORK_ERROR';
      message = `Instagram server error (${status})`;
      retryable = true;
      break;
  }

  return { code, message, retryable, statusCode: status };
}

/**
 * Utility: Promise-based delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// lib/instagram/get-account-info.ts
import type { InstagramResult, InstagramUserData } from "@/types/index";

// ✅ Configuration
const CONFIG = {
  INSTAGRAM_WEB_URL: "https://www.instagram.com",
  INSTAGRAM_API_URL: "https://i.instagram.com/api/v1/users/web_profile_info",
  MAX_RETRIES: 5,
  BASE_RETRY_DELAY: 1000,
  MAX_RETRY_DELAY: 30000, // 30 seconds cap
  REQUEST_TIMEOUT: 15000, // 15 seconds
};

/**
 * Fetch Instagram user profile info with robust error handling
 */
export const getPostInfo = async (username: string): Promise<InstagramUserData | null> => {
  const result = await fetchInstagramUser(username);
  
  if (result.success) {
    return result.data;
  }
  
  // Log non-retryable errors for debugging
  if (!result.error.retryable) {
    console.warn(`Instagram API Error [${result.error.code}]: ${result.error.message}`);
  }
  
  return null; // Return null for all failures (consistent with your existing code)
};

/**
 * Internal function with detailed error handling
 */
const fetchInstagramUser = async (username: string): Promise<InstagramResult> => {
  // ✅ Validate input
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'Invalid username provided',
        retryable: false,
      },
    };
  }

  const cleanUsername = username.trim().toLowerCase();

  // ✅ Get cookies with proper URL (no trailing spaces!)
  const cookies = await chrome.cookies.getAll({
    url: CONFIG.INSTAGRAM_WEB_URL,
  });

  if (!cookies || cookies.length === 0) {
    return {
      success: false,
      error: {
        code: 'NO_COOKIES',
        message: 'Not authenticated with Instagram. Please log in first.',
        retryable: false,
      },
    };
  }

  // ✅ Build headers
  const headers = getUserDataHeaders(cookies);
  
  // ✅ Build API URL (fixed: no extra spaces)
  const apiUrl = `${CONFIG.INSTAGRAM_API_URL}/?username=${encodeURIComponent(cleanUsername)}`;

  try {
    const response = await fetchWithTimeout(
      apiUrl,
      { headers },
      CONFIG.REQUEST_TIMEOUT
    );

    // ✅ Handle HTTP status codes
    if (!response.ok) {
      return handleHttpError(response.status);
    }

    const json = await response.json();

    // ✅ Validate response structure
    if (!json?.data?.user) {
      // Check for specific error messages from Instagram
      if (json?.message?.includes('User not found')) {
        return {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: `Username "${cleanUsername}" not found`,
            retryable: false,
          },
        };
      }
      
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'Unexpected API response format',
          retryable: true,
        },
      };
    }

    const user = json.data.user;

    // ✅ Extract and validate required fields
    const userData: InstagramUserData = {
      full_name: user.full_name ?? "",
      username: user.username ?? cleanUsername,
      id: String(user.id ?? ""),
      followers: Number(user.edge_followed_by?.count ?? 0),
      following: Number(user.edge_follow?.count ?? 0),
      post: Number(user.edge_owner_to_timeline_media?.count ?? 0),
      profile_picture: user.profile_pic_url_hd ?? user.profile_pic_url ?? "",
    };

    // ✅ Final validation: ensure we have an ID (critical field)
    if (!userData.id) {
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'Missing required user ID in response',
          retryable: true,
        },
      };
    }

    return { success: true, data: userData };

  } catch (error) {
    // ✅ Handle network/timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Request timed out',
          retryable: true,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown network error',
        retryable: true,
      },
    };
  }
};

/**
 * Handle specific HTTP status codes from Instagram API
 */
const handleHttpError = (status: number): InstagramResult => {
  switch (status) {
    case 404:
      return {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found on Instagram',
          retryable: false,
          statusCode: status,
        },
      };
    
    case 401:
    case 403:
      return {
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Authentication failed. Cookies may be expired.',
          retryable: false,
          statusCode: status,
        },
      };
    
    case 429:
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Please wait before retrying.',
          retryable: true,
          statusCode: status,
        },
      };
    
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: `Instagram server error (${status})`,
          retryable: true,
          statusCode: status,
        },
      };
    
    default:
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: `HTTP error: ${status}`,
          retryable: status >= 500, // Retry on server errors
          statusCode: status,
        },
      };
  }
};

/**
 * Build request headers with Instagram cookies
 */
function getUserDataHeaders(cookies: chrome.cookies.Cookie[]): Record<string, string> {
  const cookieString = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const csrftoken = cookies.find((c) => c.name === "csrftoken")?.value ?? "";
  const xIgWwwClaim = cookies.find((c) => c.name === "x-ig-www-claim")?.value ?? "";

  return {
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "x-asbd-id": "129477",
    "x-csrftoken": csrftoken,
    "x-ig-app-id": "936619743392459",
    "x-ig-www-claim": xIgWwwClaim,
    "cookie": cookieString,
    // ✅ Add user-agent to appear more like a browser
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with exponential backoff retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = CONFIG.MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, CONFIG.REQUEST_TIMEOUT);
      
      // ✅ Don't retry on client errors (4xx) except 429
      if (!response.ok && response.status < 500 && response.status !== 429) {
        return response; // Let caller handle the error
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // ✅ Check if we should retry
      const isRetryable = 
        error instanceof Error && 
        (error.name === 'AbortError' || // timeout
         error.message.includes('network') ||
         error.message.includes('Failed to fetch'));
      
      if (!isRetryable || attempt === maxRetries - 1) {
        break;
      }

      // ✅ Exponential backoff with jitter
      const baseDelay = CONFIG.BASE_RETRY_DELAY * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // 0-1000ms random addition
      const delay = Math.min(baseDelay + jitter, CONFIG.MAX_RETRY_DELAY);
      
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Request failed after all retries');
}

export type Account = {
  id: string;
  username: string;
  followers: number;
  following: number;
  posts: number; 
  manager: string
};

export interface Post {
  id: string;
  link: string;
  username: string;
  views: number;
  likes: number;
  comments: number;
  comment_status: "no comment" | "comment" | "reply";
  posting_time: string; // ISO string
  last_fetch_time: string; // ISO string
  account_manager: string;
  duration?: number;
}

export type Manager = {
  id: string;
  name: string;
}

// types/instagram.ts
export interface InstagramUserData {
  full_name: string;
  username: string;
  id: string;
  followers: number;
  following: number;
  post: number;
  profile_picture: string;
}

export type InstagramResult = 
  | { success: true; data: InstagramUserData }
  | { success: false; error: InstagramError };

export type InstagramErrorCode = 
  | 'NO_COOKIES'
  | 'USER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN_ERROR';

export interface InstagramError {
  code: InstagramErrorCode;
  message: string;
  retryable?: boolean;
  statusCode?: number;
}

// types/instagram-posts.ts
export interface InstagramPost {
  id: string;
  code: string;
  date: number;
  media_type: 'image' | 'video' | 'carousel';
  caption: string;
  views: number;
  comments: number;
  likes: number;
  duration: number;
  url: string | null;
  download_url: string | string[]; // Single URL or array for carousels
  thumbnail?: string; // For videos
  carousel_count?: number; // For carousel posts
}
// types/instagram-posts.ts
export type PostsResult =
  | {
      success: true;
      posts: InstagramPost[];
      hasMore?: boolean;
      nextMaxId?: string;
    }
  | {
      success: false;
      error: {
        message: string;
        code?: string;
        retryable?: boolean;
        partialPosts?: InstagramPost[];
      };
      posts?: InstagramPost[];
    };

export type PostsErrorCode = 
  | 'INVALID_INPUT'
  | 'NO_COOKIES'
  | 'USER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'PARSE_ERROR'
  | 'UNKNOWN_ERROR';

export interface PostsError {
  code: PostsErrorCode;
  message: string;
  retryable?: boolean;
  statusCode?: number;
  partialPosts?: InstagramPost[]; // Return any posts fetched before error
}

export interface PostsFetchOptions {
  postCount?: number;
  batchSize?: number;
  requestDelay?: number;
  onProgress?: (progress: { fetched: number; total: number; currentPost?: InstagramPost }) => void;
  signal?: AbortSignal; // For cancellation
}
