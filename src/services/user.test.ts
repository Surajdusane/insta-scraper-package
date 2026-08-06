import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fetchUserInfo } from "./user";
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

const profile = {
  data: {
    user: { id: "123", username: "testuser", full_name: "Test User", edge_followed_by: { count: 100 } },
  },
};

beforeEach(() => {
  installChrome();
  globalThis.fetch = async () => jsonResponse(profile);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete (globalThis as Record<string, unknown>).chrome;
});

describe("fetchUserInfo", () => {
  test("returns user info on success", async () => {
    const result = await fetchUserInfo("testuser", config);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toBe("123");
    expect(result.data.username).toBe("testuser");
    expect(result.data.followers).toBe(100);
  });

  test("detects user not found from the API message", async () => {
    globalThis.fetch = async () => jsonResponse({ message: "User not found", status: "fail" });
    const result = await fetchUserInfo("ghost", config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("USER_NOT_FOUND");
  });

  test("fails with INVALID_RESPONSE for malformed data", async () => {
    globalThis.fetch = async () => jsonResponse({ data: {} });
    const result = await fetchUserInfo("someuser", config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_RESPONSE");
  });

  test("fails with INVALID_INPUT for an empty username", async () => {
    const result = await fetchUserInfo("", config);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("INVALID_INPUT");
  });
});