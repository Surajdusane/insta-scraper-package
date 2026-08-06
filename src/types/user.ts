import type { InstagramResult } from "./error";

export interface InstagramUserInfo {
  id: string;
  username: string;
  fullName: string;
  followers: number;
  following: number;
  posts: number;
  profilePicture: string;
  isPrivate: boolean;
  isVerified: boolean;
  biography: string;
  externalUrl: string;
}

export type UserInfoResult = InstagramResult<InstagramUserInfo>;