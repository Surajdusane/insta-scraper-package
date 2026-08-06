# insta-scraper-package

Type-safe TypeScript library for scraping Instagram profile info and posts from inside a **Chrome extension** (Manifest V3). Built with Bun.

## Features

- Scrape a user's profile info: followers, following, post count, profile picture, bio, verification status
- Scrape a user's posts with automatic pagination: images, videos and carousels, with download URLs
- Auto-fetch every post of an account with a single `getAllPosts` call
- Type-safe: strict discriminated-union results, no `null` surprises
- Fully configurable: retries, timeouts, request delays, cookie domains, user agents and API endpoints can all be customized
- Cancellable via `AbortSignal`, with progress callbacks and partial results on failure
- Zero runtime dependencies

## Chrome extension setup

The user must be logged in to Instagram in the same browser, and your extension needs:

```json
{
  "manifest_version": 3,
  "permissions": ["cookies"],
  "host_permissions": [
    "https://*.instagram.com/*",
    "https://*.cdninstagram.com/*"
  ]
}
```

`cdninstagram.com` is only needed if your extension also fetches the media download URLs returned by the scraper.

## Install

```bash
bun add insta-scraper-package
# or
npm install insta-scraper-package
```

## Usage

```ts
import { createInstagramScraper } from "insta-scraper-package";

const instagram = createInstagramScraper();
```

### Get user info

```ts
const result = await instagram.getUserInfo("someusername");

if (result.success) {
  console.log(result.data.followers);
  console.log(result.data.following);
  console.log(result.data.posts);
} else {
  console.error(result.error.code, result.error.message);
}
```

### Get posts

```ts
const result = await instagram.getPosts("someusername", {
  count: 100,                 // max posts to fetch
  requestDelay: 1500,         // ms between requests
  signal,                     // optional AbortSignal to cancel
  onProgress: ({ fetched, total, currentPost }) => {
    console.log(`${fetched}/${total} - ${currentPost.code}`);
  },
});

if (result.success) {
  for (const post of result.posts) {
    console.log(post.mediaType, post.downloadUrls, post.url);
  }
  if (result.hasMore) {
    console.log("more available", result.nextMaxId);
  }
} else {
  console.error(result.error.code, result.error.message);
  console.log("partial posts:", result.posts.length);
}
```

### Get all posts (automatic)

`getAllPosts` fetches **every** post of the account automatically — no count needed. It paginates internally until there are no more posts:

```ts
const result = await instagram.getAllPosts("someusername", {
  requestDelay: 2000,        // ms between requests (be gentle to avoid rate limits)
  signal,                    // optional AbortSignal to cancel
  onProgress: ({ fetched, currentPost }) => {
    console.log(`${fetched} posts so far - ${currentPost.code}`);
  },
});

if (result.success) {
  console.log(`Fetched all ${result.posts.length} posts`);
}
```

Note: `total` in the progress callback is `0` when fetching all posts (the final count is unknown upfront).

### Get all posts (manual resume)

Each result returns `nextMaxId` — pass it back as `nextMaxId` to continue fetching from where you left off. Loop until `hasMore` is `false`:

```ts
const instagram = createInstagramScraper();
const allPosts: InstagramPost[] = [];
let cursor: string | undefined;

do {
  const result = await instagram.getPosts("someusername", {
    count: 1000000,          // effectively no cap
    requestDelay: 2000,
    nextMaxId: cursor,       // resume point
  });

  if (!result.success) break; // error already logged

  allPosts.push(...result.posts);
  cursor = result.nextMaxId;
} while (cursor);

console.log(`Fetched ${allPosts.length} posts`);
```

### Convenience exports

`getInstagramPosts(username, options)`, `getAllInstagramPosts(username, options)` and `getInstagramUser(username)` are also exported and use the default configuration.

## Custom configuration

Every constant is configurable via `createInstagramScraper`:

```ts
import { createInstagramScraper } from "insta-scraper-package";

const instagram = createInstagramScraper({
  webUrl: "https://www.instagram.com",
  apiBase: "https://i.instagram.com/api/v1",
  maxRetries: 8,
  requestTimeoutMs: 15000,
  defaultRequestDelayMs: 2000,
  cookieDomains: ["https://www.instagram.com"],
  requiredCookies: ["csrftoken", "sessionid"],
});
```

`DEFAULT_CONFIG` and `resolveConfig()` are exported for inspection and extension.

## Troubleshooting

### 400 error: `ig_business_category_subvertical has been deleted`

Some **business/professional accounts** (those with a business category set) return a 400 with this message. It is a server-side issue: Instagram removed an internal schema asset that older app versions reference. Fix by using a **current Instagram app version** in the user agent:

```ts
const instagram = createInstagramScraper({
  appUserAgent: "Instagram 439.0.0.35.60 Android (30/11; 480dpi; 1080x2340; OnePlus; ONEPLUS A5010; OnePlus5; qcom; en_US; 458229237)",
});
```

The package ships with a recent version by default; if you ever hit this error again, bump the version number in `appUserAgent` to the latest (check whatmyuseragent.com/apps/mobile-app-instagram).

## Error handling

Every call returns a discriminated union. Failures include a typed error:

| Code             | Meaning                                            | Retryable |
| ---------------- | -------------------------------------------------- | --------- |
| `NO_CHROME_API`  | Not running inside a Chrome extension / no cookies API | no    |
| `NO_COOKIES`     | User not logged in or cookies missing              | no        |
| `USER_NOT_FOUND` | Username does not exist                            | no        |
| `AUTH_FAILED`    | 401/403 - cookies expired, log in again            | no        |
| `RATE_LIMITED`   | 429 - slow down                                       | yes       |
| `NETWORK_ERROR`  | Network/timeout/server error                       | yes       |
| `INVALID_INPUT`  | Bad arguments (empty username, bad count)          | no        |
| `INVALID_RESPONSE` | Unexpected API response                          | yes       |
| `CANCELLED`      | Request aborted via `AbortSignal`                  | no        |
| `UNKNOWN_ERROR`  | Anything else                                      | varies    |

## Changelog

### 0.0.2
- Added `getAllPosts` / `getAllInstagramPosts` — auto-fetch an entire account's posts with no count required
- Added `nextMaxId` as an input option to resume scraping from a previous cursor
- Batch size is now fixed internally at 12 (Instagram's feed batch) and removed from config/options
- Updated default `appUserAgent` to a current Instagram version (fixes the `ig_business_category_subvertical` 400 on business accounts)
- Added `license` and `keywords` to `package.json`

### 0.0.1
- Initial release: `getUserInfo`, `getPosts` with pagination, configurable retries/timeouts/delays, typed errors

## Development

```bash
bun install
bun test          # run tests
bun run typecheck # type check
bun run build     # build dist (ESM + CJS + types)
```
