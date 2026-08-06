import type { InstagramUserInfo } from "../types/user";
import { asNumber, asRecord, asString } from "../utils";

export function parseUserInfo(json: unknown, fallbackUsername: string): InstagramUserInfo | null {
  const user = asRecord(asRecord(json)?.["data"])?.["user"];
  const record = asRecord(user);
  if (!record) return null;

  const id = asString(record["id"]);
  if (!id) return null;

  return {
    id,
    username: asString(record["username"]) || fallbackUsername,
    fullName: asString(record["full_name"]),
    followers: asCount(record["edge_followed_by"]),
    following: asCount(record["edge_follow"]),
    posts: asCount(record["edge_owner_to_timeline_media"]),
    profilePicture: asString(record["profile_pic_url_hd"] || record["profile_pic_url"]),
    isPrivate: record["is_private"] === true,
    isVerified: record["is_verified"] === true,
    biography: asString(record["biography"]),
    externalUrl: asString(record["external_url"]),
  };
}

function asCount(edge: unknown): number {
  return asNumber(asRecord(edge)?.["count"]);
}