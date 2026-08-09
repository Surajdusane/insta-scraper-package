import { describe, expect, test } from "bun:test";
import { buildPostUrl, parsePost } from "./post";
import { DEFAULT_CONFIG } from "../config";

const imagePost = {
  id: "100",
  code: "ABC123",
  taken_at: 1700000000,
  media_type: 1,
  caption: { text: "hello world" },
  like_count: 10,
  comment_count: 2,
  image_versions2: { candidates: [{ url: "https://cdn.example/1.jpg" }] },
};

describe("parsePost", () => {
  test("parses an image post", () => {
    const post = parsePost(imagePost, DEFAULT_CONFIG);
    expect(post).not.toBeNull();
    expect(post?.id).toBe("100");
    expect(post?.code).toBe("ABC123");
    expect(post?.mediaType).toBe("image");
    expect(post?.downloadUrls).toEqual(["https://cdn.example/1.jpg"]);
    expect(post?.thumbnail).toBe("https://cdn.example/1.jpg");
    expect(post?.url).toBe("https://www.instagram.com/p/ABC123/");
    expect(post?.caption).toBe("hello world");
    expect(post?.likes).toBe(10);
    expect(post?.comments).toBe(2);
    expect(post?.timestamp).toBe(1700000000);
  });

  test("parses a video post", () => {
    const post = parsePost(
      {
        id: "100",
        code: "ABC123",
        taken_at: 1700000000,
        media_type: 2,
        video_versions: [{ url: "https://cdn.example/v.mp4" }],
        video_duration: 15,
        video_view_count: 99,
        thumbnail_url: "https://cdn.example/t.jpg",
      },
      DEFAULT_CONFIG,
    );
    expect(post?.mediaType).toBe("video");
    expect(post?.downloadUrls).toEqual(["https://cdn.example/v.mp4"]);
    expect(post?.url).toBe("https://www.instagram.com/reel/ABC123/");
    expect(post?.views).toBe(99);
    expect(post?.duration).toBe(15);
    expect(post?.thumbnail).toBe("https://cdn.example/t.jpg");
  });

  test("parses a carousel post", () => {
    const post = parsePost(
      {
        ...imagePost,
        media_type: 8,
        carousel_media: [
          { image_versions2: { candidates: [{ url: "https://cdn.example/a.jpg" }] } },
          {
            video_versions: [{ url: "https://cdn.example/b.mp4" }],
            image_versions2: { candidates: [{ url: "https://cdn.example/b.jpg" }] },
          },
        ],
      },
      DEFAULT_CONFIG,
    );
    expect(post?.mediaType).toBe("carousel");
    expect(post?.downloadUrls).toEqual([
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.mp4",
    ]);
    expect(post?.thumbnail).toBe("https://cdn.example/a.jpg");
    expect(post?.url).toBe("https://www.instagram.com/p/ABC123/");
  });

  test("returns null for posts without media", () => {
    expect(parsePost({ id: "1", code: "x" }, DEFAULT_CONFIG)).toBeNull();
    expect(parsePost(null, DEFAULT_CONFIG)).toBeNull();
    expect(parsePost(undefined, DEFAULT_CONFIG)).toBeNull();
  });

  test("handles string captions and missing fields", () => {
    const post = parsePost(
      { id: "2", code: "DEF", caption: "raw caption", image_versions2: { candidates: [{ url: "u.jpg" }] } },
      DEFAULT_CONFIG,
    );
    expect(post?.caption).toBe("raw caption");
    expect(post?.timestamp).toBe(0);
    expect(post?.views).toBe(0);
  });

  test("uses shortcode as a fallback for code", () => {
    const post = parsePost(
      { id: "3", shortcode: "GHI", image_versions2: { candidates: [{ url: "u.jpg" }] } },
      DEFAULT_CONFIG,
    );
    expect(post?.code).toBe("GHI");
  });
});

describe("buildPostUrl", () => {
  test("builds photo, reel and no-code URLs", () => {
    expect(buildPostUrl("https://www.instagram.com", "ABC", "image")).toBe(
      "https://www.instagram.com/p/ABC/",
    );
    expect(buildPostUrl("https://www.instagram.com", "ABC", "video")).toBe(
      "https://www.instagram.com/reel/ABC/",
    );
    expect(buildPostUrl("https://www.instagram.com/", "ABC", "carousel")).toBe(
      "https://www.instagram.com/p/ABC/",
    );
    expect(buildPostUrl("https://www.instagram.com", "", "image")).toBe("");
  });
});