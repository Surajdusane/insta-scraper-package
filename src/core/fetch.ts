import type { InstagramConfig } from "../config";
import { mapHttpError } from "./http";
import type { InstagramResult } from "../types/error";

type FetchJsonResult = InstagramResult<unknown>;

export async function fetchJsonWithRetry(
  url: string,
  config: InstagramConfig,
  init: RequestInit = {},
): Promise<FetchJsonResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init, config.requestTimeoutMs);

      if (!response.ok) {
        const error = await mapHttpError(response);
        if (!error.retryable || attempt === config.maxRetries - 1) {
          return { success: false, error };
        }
      } else {
        try {
          const data = await response.json();
          return { success: true, data };
        } catch {
          return {
            success: false,
            error: {
              code: "INVALID_RESPONSE",
              message: "Failed to parse Instagram API response as JSON",
              retryable: false,
            },
          };
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryableError(lastError, init.signal ?? undefined) || attempt === config.maxRetries - 1) {
        break;
      }
    }

    await backoffDelay(config.baseRetryDelayMs, config.maxRetryDelayMs, attempt);
  }

  return {
    success: false,
    error: {
      code: "NETWORK_ERROR",
      message: lastError?.message ?? "Request failed after all retries",
      retryable: false,
    },
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = init.signal ? mergeSignals(controller.signal, init.signal) : controller.signal;
  try {
    return await fetch(url, { ...init, signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function mergeSignals(...signals: AbortSignal[]): AbortSignal {
  const merged = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      merged.abort();
      break;
    }
    signal.addEventListener("abort", () => merged.abort(), { once: true });
  }
  return merged.signal;
}

function isRetryableError(error: Error, signal?: AbortSignal): boolean {
  if (signal?.aborted) return false;
  return (
    error.name === "AbortError" ||
    /network|timeout|failed to fetch/i.test(error.message)
  );
}

async function backoffDelay(baseDelayMs: number, maxDelayMs: number, attempt: number): Promise<void> {
  const base = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  const ms = Math.min(base + jitter, maxDelayMs);
  await new Promise((resolve) => setTimeout(resolve, ms));
}