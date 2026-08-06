import { describe, expect, test } from "bun:test";
import { extractShortcode, shortcodeToMediaId } from "./convert";

describe("extractShortcode", () => {
  test("extracts from reel, reels, p and tv URLs", () => {
    expect(extractShortcode("https://www.instagram.com/reel/B-0AY7oJ4cX/")).toBe("B-0AY7oJ4cX");
    expect(extractShortcode("https://www.instagram.com/reels/B-0AY7oJ4cX/")).toBe("B-0AY7oJ4cX");
    expect(extractShortcode("https://www.instagram.com/p/ABC123/")).toBe("ABC123");
    expect(extractShortcode("https://www.instagram.com/tv/XYZ_9/")).toBe("XYZ_9");
  });

  test("ignores query strings and trailing content", () => {
    expect(extractShortcode("https://www.instagram.com/p/ABC123/?img_index=1&hl=en")).toBe("ABC123");
  });

  test("returns null for non-post URLs", () => {
    expect(extractShortcode("https://www.instagram.com/")).toBeNull();
    expect(extractShortcode("https://www.instagram.com/stories/user/123/")).toBeNull();
    expect(extractShortcode("not a url")).toBeNull();
  });
});

describe("shortcodeToMediaId", () => {
  test("converts a shortcode to its numeric media id", () => {
    expect(shortcodeToMediaId("B-0AY7oJ4cX")).toBe("2284452624275572503");
    expect(shortcodeToMediaId("ABC123")).toBe("17522103");
  });

  test("throws on invalid characters", () => {
    expect(() => shortcodeToMediaId("ABC!23")).toThrow("Invalid character '!'");
  });
});