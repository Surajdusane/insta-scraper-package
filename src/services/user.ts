import type { InstagramConfig } from "../config";
import type { UserInfoResult } from "../types/user";
import { fetchJsonWithRetry } from "../core/fetch";
import { getInstagramCookies } from "../core/cookies";
import { buildInstagramHeaders } from "../core/headers";
import { parseUserInfo } from "../parser/user";
import { validateUsername } from "../validate";
import { asRecord } from "../utils";

export async function fetchUserInfo(username: string, config: InstagramConfig): Promise<UserInfoResult> {
  const usernameError = validateUsername(username);
  if (usernameError) {
    return {
      success: false,
      error: { code: "INVALID_INPUT", message: usernameError, retryable: false },
    };
  }

  const cleanUsername = username.trim().toLowerCase();

  const cookiesResult = await getInstagramCookies(config);
  if (!cookiesResult.success) {
    return { success: false, error: cookiesResult.error };
  }

  const headers = buildInstagramHeaders(config, cookiesResult.data, "web");
  const url = `${config.apiBase.replace(/\/+$/, "")}/${config.userProfilePath}?username=${encodeURIComponent(cleanUsername)}`;

  const result = await fetchJsonWithRetry(url, config, { headers });
  if (!result.success) return result;

  const userInfo = parseUserInfo(result.data, cleanUsername);
  if (userInfo) return { success: true, data: userInfo };

  const message = getResponseMessage(result.data);
  if (/user not found/i.test(message)) {
    return {
      success: false,
      error: {
        code: "USER_NOT_FOUND",
        message: `Username "${cleanUsername}" not found`,
        retryable: false,
      },
    };
  }

  return {
    success: false,
    error: {
      code: "INVALID_RESPONSE",
      message: "Unexpected API response format",
      retryable: true,
    },
  };
}

function getResponseMessage(json: unknown): string {
  const record = asRecord(json);
  return typeof record?.["message"] === "string" ? record["message"] : "";
}