import { describe, expect, test } from "bun:test";
import { parseUserInfo } from "./user";

const profileJson = {
  data: {
    user: {
      id: "123",
      username: "testuser",
      full_name: "Test User",
      edge_followed_by: { count: 1000 },
      edge_follow: { count: 500 },
      edge_owner_to_timeline_media: { count: 42 },
      profile_pic_url_hd: "https://cdn.example/pic.jpg",
      is_private: false,
      is_verified: true,
      biography: "Bio here",
      external_url: "https://example.com",
    },
  },
};

describe("parseUserInfo", () => {
  test("parses a full profile", () => {
    const user = parseUserInfo(profileJson, "testuser");
    expect(user).not.toBeNull();
    expect(user).toEqual({
      id: "123",
      username: "testuser",
      fullName: "Test User",
      followers: 1000,
      following: 500,
      posts: 42,
      profilePicture: "https://cdn.example/pic.jpg",
      isPrivate: false,
      isVerified: true,
      biography: "Bio here",
      externalUrl: "https://example.com",
    });
  });

  test("falls back to the requested username when missing", () => {
    const json = { data: { user: { id: "1" } } };
    const user = parseUserInfo(json, "fallback");
    expect(user?.username).toBe("fallback");
    expect(user?.followers).toBe(0);
  });

  test("returns null when the user object is missing", () => {
    expect(parseUserInfo({ data: {} }, "x")).toBeNull();
    expect(parseUserInfo({}, "x")).toBeNull();
    expect(parseUserInfo(null, "x")).toBeNull();
  });

  test("returns null when the user id is missing", () => {
    expect(parseUserInfo({ data: { user: { username: "noid" } } }, "noid")).toBeNull();
  });
});