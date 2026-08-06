import type { InstagramConfig } from "./config";
import { resolveConfig } from "./config";
import { fetchAllUserPosts, fetchUserPosts } from "./services/posts";
import { fetchUserInfo } from "./services/user";
import type { PostsFetchOptions, PostsResult } from "./types/post";
import type { UserInfoResult } from "./types/user";

export interface InstagramScraper {
  config: InstagramConfig;
  getPosts(username: string, options?: PostsFetchOptions): Promise<PostsResult>;
  getAllPosts(
    username: string,
    options?: Omit<PostsFetchOptions, "count" | "nextMaxId">,
  ): Promise<PostsResult>;
  getUserInfo(username: string): Promise<UserInfoResult>;
}

export function createInstagramScraper(config: Partial<InstagramConfig> = {}): InstagramScraper {
  const resolved = resolveConfig(config);
  return {
    config: resolved,
    getPosts: (username, options = {}) => fetchUserPosts(username, resolved, options),
    getAllPosts: (username, options = {}) => fetchAllUserPosts(username, resolved, options),
    getUserInfo: (username) => fetchUserInfo(username, resolved),
  };
}