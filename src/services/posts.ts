import type { InstagramConfig } from "../config";
import type { InstagramError } from "../types/error";
import type { InstagramPost, PostsFetchOptions, PostsResult } from "../types/post";
import { delay } from "../core/delay";
import { fetchJsonWithRetry } from "../core/fetch";
import { getInstagramCookies } from "../core/cookies";
import { buildInstagramHeaders } from "../core/headers";
import { parsePost } from "../parser/post";
import { validatePositiveInteger, validateUsername } from "../validate";
import { asArray, asRecord } from "../utils";

const BATCH_SIZE = 12;

export async function fetchUserPosts(
  username: string,
  config: InstagramConfig,
  options: PostsFetchOptions = {},
): Promise<PostsResult> {
  const count = options.count ?? config.defaultCount;

  const countError = validatePositiveInteger(count, "count");
  if (countError) {
    return failure({ code: "INVALID_INPUT", message: countError, retryable: false });
  }

  return fetchPostsInternal(username, config, options, count);
}

export async function fetchAllUserPosts(
  username: string,
  config: InstagramConfig,
  options: Omit<PostsFetchOptions, "count" | "nextMaxId"> = {},
): Promise<PostsResult> {
  return fetchPostsInternal(username, config, options, null);
}

async function fetchPostsInternal(
  username: string,
  config: InstagramConfig,
  options: PostsFetchOptions,
  maxCount: number | null,
): Promise<PostsResult> {
  const requestDelay = options.requestDelay ?? config.defaultRequestDelayMs;

  const usernameError = validateUsername(username);
  if (usernameError) {
    return failure({ code: "INVALID_INPUT", message: usernameError, retryable: false });
  }

  const cleanUsername = username.trim().toLowerCase();
  const collected: InstagramPost[] = [];
  const startMaxId = options.nextMaxId && options.nextMaxId.length > 0 ? options.nextMaxId : null;
  let maxId: string | null = startMaxId;
  let hasMore = false;
  let requestsMade = 0;

  const cookiesResult = await getInstagramCookies(config);
  if (!cookiesResult.success) {
    return failure(cookiesResult.error);
  }

  const headers = buildInstagramHeaders(config, cookiesResult.data, "app");
  const endpoint = buildFeedUrl(config, cleanUsername);

  while (maxCount === null || collected.length < maxCount) {
    if (options.signal?.aborted) {
      return failure({ code: "CANCELLED", message: "Request cancelled", retryable: false }, collected);
    }

    if (requestsMade > 0) {
      await delay(requestDelay);
    }

    const url = `${endpoint}?${buildPaginationQuery(maxId)}`;
    const result = await fetchJsonWithRetry(url, config, {
      headers,
      signal: options.signal,
    });

    if (!result.success) {
      if (options.signal?.aborted) {
        return failure({ code: "CANCELLED", message: "Request cancelled", retryable: false }, collected);
      }
      return failure(result.error, collected);
    }

    const data = asRecord(result.data);
    const message = typeof data?.["message"] === "string" ? data["message"] : "";

    if (data?.["status"] === "fail" || /user not found/i.test(message)) {
      return failure(
        { code: "USER_NOT_FOUND", message: `Username "${cleanUsername}" not found`, retryable: false },
        collected,
      );
    }

    if (!Array.isArray(data?.["items"])) {
      return failure(
        { code: "INVALID_RESPONSE", message: "Unexpected API response format", retryable: true },
        collected,
      );
    }

    const items = asArray(data["items"]);

    for (const item of items) {
      if (maxCount !== null && collected.length >= maxCount) break;
      const post = parsePost(item, config);
      if (!post) continue;
      collected.push(post);
      options.onProgress?.({ fetched: collected.length, total: maxCount ?? 0, currentPost: post });
    }

    const nextMaxId = data?.["next_max_id"];
    const hasNextPage =
      typeof nextMaxId === "string" &&
      nextMaxId.length > 0 &&
      items.length > 0 &&
      data?.["more_available"] !== false;

    maxId = hasNextPage ? nextMaxId : null;
    hasMore = hasNextPage;

    if (!hasNextPage) break;
    requestsMade++;
  }

  return {
    success: true,
    posts: collected.slice(0, maxCount ?? collected.length),
    hasMore,
    nextMaxId: maxId ?? undefined,
  };
}

function failure(error: InstagramError, posts: InstagramPost[] = []): PostsResult {
  return { success: false, error, posts };
}

function buildFeedUrl(config: InstagramConfig, username: string): string {
  const path = config.userFeedPath.replace("{username}", encodeURIComponent(username));
  return `${config.apiBase.replace(/\/+$/, "")}/${path}`;
}

function buildPaginationQuery(maxId: string | null): string {
  const params = new URLSearchParams({ count: String(BATCH_SIZE) });
  if (maxId) params.set("max_id", maxId);
  return params.toString();
}