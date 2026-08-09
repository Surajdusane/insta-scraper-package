import type { InstagramError } from "./error";

export type InstagramMediaType = "image" | "video" | "carousel";

export interface InstagramPost {
  id: string;
  code: string;
  timestamp: number;
  mediaType: InstagramMediaType;
  caption: string;
  views: number;
  comments: number;
  likes: number;
  duration: number;
  url: string;
  downloadUrls: string[];
  thumbnail: string;
}

export interface PostsProgress {
  fetched: number;
  total: number;
  currentPost: InstagramPost;
}

export interface PostsFetchOptions {
  count?: number;
  requestDelay?: number;
  nextMaxId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: PostsProgress) => void;
}

export type PostsResult =
  | {
      success: true;
      posts: InstagramPost[];
      hasMore: boolean;
      nextMaxId?: string;
    }
  | {
      success: false;
      error: InstagramError;
      posts: InstagramPost[];
    };