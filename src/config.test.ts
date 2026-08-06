import { describe, expect, test } from "bun:test";
import { DEFAULT_CONFIG, resolveConfig } from "./config";

describe("resolveConfig", () => {
  test("returns defaults when no overrides are given", () => {
    expect(resolveConfig()).toEqual(DEFAULT_CONFIG);
  });

  test("merges partial overrides and keeps the rest", () => {
    const config = resolveConfig({ maxRetries: 2, requestTimeoutMs: 5000 });
    expect(config.maxRetries).toBe(2);
    expect(config.requestTimeoutMs).toBe(5000);
    expect(config.maxRetryDelayMs).toBe(DEFAULT_CONFIG.maxRetryDelayMs);
  });

  test("accepts full overrides of array values", () => {
    const config = resolveConfig({ cookieDomains: ["https://example.com"] });
    expect(config.cookieDomains).toEqual(["https://example.com"]);
  });
});