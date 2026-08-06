import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fetchSinglePostInfo } from "./single-post";
import { resolveConfig } from "../config";

const config = resolveConfig({ maxRetries: 1, requestTimeoutMs: 500 });

function installChrome() {
  (globalThis as Record<string, unknown>).chrome = {
    cookies: {
      getAll: async () => [
        { name: "csrftoken", value: "csrf" },
        { name: "sessionid", value: "session" },
      ],
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const realFetch = globalThis.fetch;

const postItem = {
  pk: "2284452624275572503",
  code: "B-0AY7oJ4cX",
  taken_at: 1700000000,
  like_count: 5,
  comment_count: 1,
  image_versions2: { candidates: [{ url: "https://cdn.example/post.jpg" }] },
};

beforeEach(() => {
  installChrome();
  globalThis.fetch = async () => jsonResponse({ items: [postItem] });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as Record<string, unknown>).chrome;
});

describe("fetchSinglePostInfo", () => {
  test("returns post info for a reel URL", async () => {
    let requestedUrl = "";
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse({ items: [postItem] });
    };

    const result = await fetchSinglePostInfo("https://www.instagram.com/reel/B-0AY7oJ4cX/", config);

    expect(requestedUrl).toContain("/media/2284452624275572503/info");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toBe("2284452624275572503");
    expect(result.data.code).toBe("B-0AY7oJ4cX");
    expect(result.data.mediaType).toBe("image");
    expect(result.data.url).toBe("https://www.instagram.com/p/B-0AY7oJ4cX/");
  });

  test("handles p and reels URLs", async () => {
    for (const kind of ["p", "reels"]) {
      const result = await fetchSinglePostInfo(`https://www.instagram.com/${kind}/ABC123/`, config);
      expect(result.success).toBe(true);
    }
  });

  test("fails with INVALID_INPUT when the URL has no post shortcode", async () => {
    const result = await fetchSinglePostInfo("https://www.instagram.com/explore/", config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  test("fails with INVALID_INPUT for an empty URL", async () => {
    const result = await fetchSinglePostInfo("", config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_INPUT");
  });

  test("fails with INVALID_RESPONSE when no post is returned", async () => {
    globalThis.fetch = async () => jsonResponse({ items: [] });
    const result = await fetchSinglePostInfo("https://www.instagram.com/p/ABC123/", config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_RESPONSE");
  });

  test("fails with NO_COOKIES when not logged in", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      cookies: { getAll: async () => [] },
    };
    const result = await fetchSinglePostInfo("https://www.instagram.com/p/ABC123/", config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("NO_COOKIES");
  });
});