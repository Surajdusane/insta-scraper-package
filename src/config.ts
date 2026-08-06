export interface InstagramConfig {
  webUrl: string;
  apiBase: string;
  userProfilePath: string;
  userFeedPath: string;
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  requestTimeoutMs: number;
  defaultCount: number;
  defaultRequestDelayMs: number;
  cookieDomains: string[];
  requiredCookies: string[];
  appUserAgent: string;
  webUserAgent: string;
  appId: string;
  asbdId: string;
}

export const DEFAULT_CONFIG: InstagramConfig = {
  webUrl: "https://www.instagram.com",
  apiBase: "https://i.instagram.com/api/v1",
  userProfilePath: "users/web_profile_info",
  userFeedPath: "feed/user/{username}/username",
  maxRetries: 5,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  requestTimeoutMs: 20000,
  defaultCount: 3000,
  defaultRequestDelayMs: 1500,
  cookieDomains: [
    "https://www.instagram.com",
    "https://i.instagram.com",
    "https://instagram.com",
  ],
  requiredCookies: ["csrftoken", "sessionid"],
  appUserAgent:
    "Instagram 439.0.0.35.60 Android (30/11; 480dpi; 1080x2340; OnePlus; ONEPLUS A5010; OnePlus5; qcom; en_US; 458229237)",
  webUserAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  appId: "936619743392459",
  asbdId: "129477",
};

export function resolveConfig(config: Partial<InstagramConfig> = {}): InstagramConfig {
  return { ...DEFAULT_CONFIG, ...config };
}