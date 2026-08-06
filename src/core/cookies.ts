import type { InstagramConfig } from "../config";
import type { ChromeApi, ChromeCookie } from "../types/chrome";
import type { InstagramError, InstagramResult } from "../types/error";

export interface InstagramCookies {
  cookieString: string;
  csrftoken: string;
  igWwwClaim?: string;
}

export type CookieResult = InstagramResult<InstagramCookies>;

export function getInstagramCookies(config: InstagramConfig): Promise<CookieResult> {
  const chromeApi = getChromeApi();
  if (!chromeApi) {
    return Promise.resolve({
      success: false,
      error: {
        code: "NO_CHROME_API",
        message:
          "chrome.cookies API is not available. This package must run inside a Chrome extension with the cookies permission.",
        retryable: false,
      },
    });
  }

  return readCookies(chromeApi, config);
}

async function readCookies(chromeApi: ChromeApi, config: InstagramConfig): Promise<CookieResult> {
  for (const domain of config.cookieDomains) {
    try {
      const cookies = await chromeApi.cookies.getAll({ url: domain });
      if (cookies.length === 0) continue;

      if (hasRequiredCookies(cookies, config.requiredCookies)) {
        return { success: true, data: buildCookies(cookies) };
      }
    } catch (error) {
      console.warn(`Failed to read cookies from ${domain}`, error);
    }
  }

  const error: InstagramError = {
    code: "NO_COOKIES",
    message: `Not authenticated with Instagram. Required cookies (${config.requiredCookies.join(", ")}) not found. Please log in first.`,
    retryable: false,
  };
  return { success: false, error };
}

function getChromeApi(): ChromeApi | null {
  const chromeApi = (globalThis as { chrome?: ChromeApi }).chrome;
  if (chromeApi?.cookies && typeof chromeApi.cookies.getAll === "function") {
    return chromeApi;
  }
  return null;
}

function hasRequiredCookies(cookies: ChromeCookie[], required: string[]): boolean {
  const names = new Set(cookies.map((cookie) => cookie.name));
  return required.every((name) => names.has(name));
}

function buildCookies(cookies: ChromeCookie[]): InstagramCookies {
  const findValue = (name: string): string | undefined =>
    cookies.find((cookie) => cookie.name === name)?.value;

  const igWwwClaim = findValue("x-ig-www-claim");
  return {
    cookieString: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    csrftoken: findValue("csrftoken") ?? "",
    ...(igWwwClaim ? { igWwwClaim } : {}),
  };
}