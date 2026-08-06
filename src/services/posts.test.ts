import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fetchAllUserPosts, fetchUserPosts } from "./posts";
import { resolveConfig } from "../config";

const config = resolveConfig({ maxRetries: 1, requestTimeoutMs: 500, defaultRequestDelayMs: 1 });

const postFixture = (id: string, code: string) => ({
  id,
  code,
  taken_at: 1700000000,
  like_count: 1,
  comment_count: 0,
  image_versions2: { candidates: [{ url: `https://cdn.example/${id}.jpg` }] },
});

function installChrome(cookies: Array<{ name: string; value: string }> = [
  { name: "csrftoken", value: "csrf" },
  { name: "sessionid", value: "session" },
]) {
  (globalThis as Record<string, unknown>).chrome = {
    cookies: { getAll: async () => cookies },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  installChrome();
  globalThis.fetch = async () => jsonResponse({ items: [] });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as Record<string, unknown>).chrome;
});

describe("fetchUserPosts", () => {
  test("fetches posts across multiple pages", async () => {
    const pages = [
      { items: [postFixture("1", "AAA")], next_max_id: "page2", more_available: true },
      { items: [postFixture("2", "BBB")] },
    ];
    let callCount = 0;
    globalThis.fetch = async () => jsonResponse(pages[callCount++] ?? { items: [] });

    const result = await fetchUserPosts("testuser", config);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.posts).toHaveLength(2);
    expect(result.posts[0]?.id).toBe("1");
    expect(result.posts[1]?.id).toBe("2");
    expect(result.hasMore).toBe(false);
    expect(result.nextMaxId).toBeUndefined();
  });

  test("stops paginating when the requested count is reached", async () => {
    const pages = [
      { items: [postFixture("1", "AAA")], next_max_id: "page2", more_available: true },
      { items: [postFixture("2", "BBB")], next_max_id: "page3", more_available: true },
    ];
    let callCount = 0;
    globalThis.fetch = async () => jsonResponse(pages[callCount++] ?? { items: [] });

    const result = await fetchUserPosts("testuser", { ...config, defaultCount: 1 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.posts).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextMaxId).toBe("page2");
  });

  test("resumes pagination from a provided cursor", async () => {
    let requestedUrl = "";
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return jsonResponse({ items: [postFixture("2", "BBB"), postFixture("3", "CCC")] });
    };

    const result = await fetchUserPosts("testuser", config, {
      count: 5,
      nextMaxId: "page2",
    });

    expect(requestedUrl).toContain("max_id=page2");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.posts.map((p) => p.id)).toEqual(["2", "3"]);
    expect(result.hasMore).toBe(false);
  });

  test("reports progress for each post", async () => {    globalThis.fetch = async () =>
      jsonResponse({ items: [postFixture("1", "AAA"), postFixture("2", "BBB")] });

    const progress: Array<{ fetched: number; total: number }> = [];
    const result = await fetchUserPosts("testuser", config, {
      count: 2,
      onProgress: (p) => progress.push({ fetched: p.fetched, total: p.total }),
    });

    expect(result.success).toBe(true);
    expect(progress).toEqual([
      { fetched: 1, total: 2 },
      { fetched: 2, total: 2 },
    ]);
  });

  test("returns partial posts when a request fails mid-way", async () => {
    const pages = [
      { items: [postFixture("1", "AAA")], next_max_id: "page2", more_available: true },
    ];
    let callCount = 0;
    globalThis.fetch = async () => {
      const page = pages[callCount++];
      if (page) return jsonResponse(page);
      return jsonResponse({ message: "rate limited" }, 429);
    };

    const result = await fetchUserPosts("testuser", config, { count: 10 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("RATE_LIMITED");
    expect(result.posts).toHaveLength(1);
  });

  test("detects user not found from the API message", async () => {
    globalThis.fetch = async () => jsonResponse({ status: "fail", message: "user not found" });

    const result = await fetchUserPosts("missinguser", config);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("USER_NOT_FOUND");
  });

  test("fails with NO_COOKIES when required cookies are missing", async () => {
    installChrome([{ name: "sessionid", value: "session" }]);

    const result = await fetchUserPosts("testuser", config);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("NO_COOKIES");
  });

  test("returns CANCELLED with partial posts when the signal aborts", async () => {
    const controller = new AbortController();
    globalThis.fetch = async () => {
      controller.abort();
      return jsonResponse({ items: [postFixture("1", "AAA")], next_max_id: "page2", more_available: true });
    };

    const result = await fetchUserPosts("testuser", config, {
      count: 10,
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("CANCELLED");
  });

  test("fails with INVALID_INPUT for invalid arguments", async () => {
    const badUsername = await fetchUserPosts("   ", config);
    expect(badUsername.success).toBe(false);
    if (badUsername.success) return;
    expect(badUsername.error.code).toBe("INVALID_INPUT");

    const badCount = await fetchUserPosts("testuser", config, { count: -5 });
    expect(badCount.success).toBe(false);
    if (badCount.success) return;
    expect(badCount.error.code).toBe("INVALID_INPUT");
  });
});

describe("fetchAllUserPosts", () => {
  test("fetches every page until pagination ends", async () => {
    const pages = [
      { items: [postFixture("1", "AAA")], next_max_id: "page2", more_available: true },
      { items: [postFixture("2", "BBB")], next_max_id: "page3", more_available: true },
      { items: [postFixture("3", "CCC")] },
    ];
    let callCount = 0;
    globalThis.fetch = async () => jsonResponse(pages[callCount++] ?? { items: [] });

    const result = await fetchAllUserPosts("testuser", config);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.posts.map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(result.posts.length).toBe(3);
    expect(result.hasMore).toBe(false);
    expect(result.nextMaxId).toBeUndefined();
  });

  test("reports progress with total 0 (unlimited)", async () => {
    globalThis.fetch = async () =>
      jsonResponse({ items: [postFixture("1", "AAA"), postFixture("2", "BBB")] });

    const progress: Array<{ fetched: number; total: number }> = [];
    const result = await fetchAllUserPosts("testuser", config, {
      onProgress: (p) => progress.push({ fetched: p.fetched, total: p.total }),
    });

    expect(result.success).toBe(true);
    expect(progress).toEqual([
      { fetched: 1, total: 0 },
      { fetched: 2, total: 0 },
    ]);
  });

  test("returns partial posts when cancelled", async () => {
    const controller = new AbortController();
    globalThis.fetch = async () => {
      controller.abort();
      return jsonResponse({ items: [postFixture("1", "AAA")], next_max_id: "page2", more_available: true });
    };

    const result = await fetchAllUserPosts("testuser", config, { signal: controller.signal });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("CANCELLED");
    expect(result.posts).toHaveLength(1);
  });
});