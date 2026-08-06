import type { InstagramConfig } from "./config";
import { resolveConfig } from "./config";
import { fetchAllUserPosts, fetchUserPosts } from "./services/posts";
import { fetchSinglePostInfo } from "./services/single-post";
import { fetchUserInfo } from "./services/user";
import type { InstagramResult } from "./types/error";
import type { InstagramPost, PostsFetchOptions, PostsResult } from "./types/post";
import type { UserInfoResult } from "./types/user";

export interface InstagramScraper {
  config: InstagramConfig;
  getPosts(username: string, options?: PostsFetchOptions): Promise<PostsResult>;
  getAllPosts(
    username: string,
    options?: Omit<PostsFetchOptions, "count" | "nextMaxId">,
  ): Promise<PostsResult>;
  getPostInfo(url: string): Promise<InstagramResult<InstagramPost>>;
  getUserInfo(username: string): Promise<UserInfoResult>;
}

export function createInstagramScraper(config: Partial<InstagramConfig> = {}): InstagramScraper {
  const resolved = resolveConfig(config);
  return {
    config: resolved,
    getPosts: (username, options = {}) => fetchUserPosts(username, resolved, options),
    getAllPosts: (username, options = {}) => fetchAllUserPosts(username, resolved, options),
    getPostInfo: (url) => fetchSinglePostInfo(url, resolved),
    getUserInfo: (username) => fetchUserInfo(username, resolved),
  };
}