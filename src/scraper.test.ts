import { describe, expect, test } from "bun:test";
import { createInstagramScraper } from "./scraper";
import { DEFAULT_CONFIG } from "./config";

describe("createInstagramScraper", () => {
  test("uses default config and exposes the expected API", () => {
    const scraper = createInstagramScraper();
    expect(scraper.config).toEqual(DEFAULT_CONFIG);
    expect(typeof scraper.getPosts).toBe("function");
    expect(typeof scraper.getUserInfo).toBe("function");
  });

  test("merges config overrides", () => {
    const scraper = createInstagramScraper({ maxRetries: 3, defaultCount: 500 });
    expect(scraper.config.maxRetries).toBe(3);
    expect(scraper.config.defaultCount).toBe(500);
  });
});