export function validateUsername(username: unknown): string | null {
  if (typeof username !== "string" || username.trim().length === 0) {
    return "Username must be a non-empty string";
  }
  return null;
}

export function validatePositiveInteger(value: unknown, name: string): string | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return `${name} must be a positive integer`;
  }
  return null;
}