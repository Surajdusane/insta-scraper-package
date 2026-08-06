import type { InstagramConfig } from "../config";
import type { InstagramCookies } from "./cookies";

export type HeaderMode = "app" | "web";

export function buildInstagramHeaders(
  config: InstagramConfig,
  cookies: InstagramCookies,
  mode: HeaderMode,
): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": mode === "app" ? config.appUserAgent : config.webUserAgent,
    "x-asbd-id": config.asbdId,
    "x-csrftoken": cookies.csrftoken,
    "x-ig-app-id": config.appId,
    "x-ig-www-claim": cookies.igWwwClaim ?? "",
    cookie: cookies.cookieString,
  };

  if (mode === "app") {
    headers["x-ads-opt-out"] = "1";
    headers["x-bloks-is-panorama-enabled"] = "true";
  }

  return headers;
}