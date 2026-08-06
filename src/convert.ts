const SHORTCODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function extractShortcode(url: string): string | null {
  const match = url.match(/(?:reel|reels|p|tv)\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

export function shortcodeToMediaId(shortcode: string): string {
  let mediaId = BigInt(0);

  for (const char of shortcode) {
    const index = SHORTCODE_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid character '${char}' in shortcode.`);
    }
    mediaId = mediaId * BigInt(64) + BigInt(index);
  }

  return mediaId.toString();
}