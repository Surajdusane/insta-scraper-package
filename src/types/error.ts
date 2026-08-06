export type InstagramErrorCode =
  | "NO_CHROME_API"
  | "NO_COOKIES"
  | "USER_NOT_FOUND"
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "NETWORK_ERROR"
  | "INVALID_INPUT"
  | "INVALID_RESPONSE"
  | "CANCELLED"
  | "UNKNOWN_ERROR";

export interface InstagramError {
  code: InstagramErrorCode;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

export type InstagramResult<T> =
  | { success: true; data: T }
  | { success: false; error: InstagramError };