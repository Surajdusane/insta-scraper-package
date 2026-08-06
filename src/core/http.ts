import type { InstagramError } from "../types/error";

export async function mapHttpError(response: Response): Promise<InstagramError> {
  const status = response.status;

  let message = `HTTP error: ${status}`;
  const body = await response.text().catch(() => "");
  if (body) {
    message += ` - ${body.slice(0, 200)}`;
  }

  const base: InstagramError = {
    code: "UNKNOWN_ERROR",
    message,
    retryable: status >= 500,
    statusCode: status,
  };

  switch (status) {
    case 404:
      return { ...base, code: "USER_NOT_FOUND", message: "User not found", retryable: false };
    case 401:
    case 403:
      return {
        ...base,
        code: "AUTH_FAILED",
        message: "Authentication failed. Cookies may be expired.",
        retryable: false,
      };
    case 429:
      return {
        ...base,
        code: "RATE_LIMITED",
        message: "Rate limit exceeded. Please wait before retrying.",
        retryable: true,
      };
    case 400:
      return { ...base, code: "INVALID_INPUT", retryable: false };
    case 500:
    case 502:
    case 503:
    case 504:
      return { ...base, code: "NETWORK_ERROR", message: `Instagram server error (${status})`, retryable: true };
    default:
      return base;
  }
}