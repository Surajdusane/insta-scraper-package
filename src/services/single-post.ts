import type { InstagramConfig } from "../config";
import type { InstagramResult } from "../types/error";
import type { InstagramPost } from "../types/post";
import { fetchJsonWithRetry } from "../core/fetch";
import { getInstagramCookies } from "../core/cookies";
import { buildInstagramHeaders } from "../core/headers";
import { parsePost } from "../parser/post";
import { extractShortcode, shortcodeToMediaId } from "../convert";
import { asArray, asRecord } from "../utils";

export async function fetchSinglePostInfo(
  url: string,
  config: InstagramConfig,
): Promise<InstagramResult<InstagramPost>> {
  if (typeof url !== "string" || url.trim().length === 0) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Post URL must be a non-empty string",
        retryable: false,
      },
    };
  }

  const shortcode = extractShortcode(url);
  if (!shortcode) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: `Could not extract a post shortcode from URL: "${url}"`,
        retryable: false,
      },
    };
  }

  let mediaId: string;
  try {
    mediaId = shortcodeToMediaId(shortcode);
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: error instanceof Error ? error.message : "Invalid post shortcode",
        retryable: false,
      },
    };
  }

  const cookiesResult = await getInstagramCookies(config);
  if (!cookiesResult.success) {
    return { success: false, error: cookiesResult.error };
  }

  const headers = buildInstagramHeaders(config, cookiesResult.data, "app");
  const endpoint = config.postInfoPath.replace("{mediaId}", mediaId);
  const apiUrl = `${config.apiBase.replace(/\/+$/, "")}/${endpoint}`;

  const result = await fetchJsonWithRetry(apiUrl, config, { headers });
  if (!result.success) return result;

  const items = asArray(asRecord(result.data)?.["items"]);
  const post = items.length > 0 ? parsePost(items[0], config) : null;
  if (!post) {
    return {
      success: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "Instagram did not return a valid post for this URL",
        retryable: false,
      },
    };
  }

  return { success: true, data: post };
}