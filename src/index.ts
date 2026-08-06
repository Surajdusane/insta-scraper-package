import { createInstagramScraper } from "./scraper";

export { createInstagramScraper } from "./scraper";
export type { InstagramScraper } from "./scraper";
export { DEFAULT_CONFIG, resolveConfig } from "./config";
export type { InstagramConfig } from "./config";
export * from "./types";

const defaultScraper = createInstagramScraper();

export const getInstagramPosts = defaultScraper.getPosts;
export const getAllInstagramPosts = defaultScraper.getAllPosts;
export const getInstagramUser = defaultScraper.getUserInfo;