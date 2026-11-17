import type { InstagramConfig } from "../config";
import type { InstagramMediaType, InstagramPost } from "../types/post";
import { asArray, asNumber, asOptionalString, asRecord, asString } from "../utils";

export function parsePost(raw: unknown, config: InstagramConfig): InstagramPost | null {
  const item = asRecord(raw);
  if (!item) return null;

  const videoVersions = asArray(item["video_versions"]);
  const imageCandidates = asArray(asRecord(item["image_versions2"])?.["candidates"]);
  const carouselMedia = asArray(item["carousel_media"]);

  const hasVideo = videoVersions.length > 0;
  const hasImage = imageCandidates.length > 0;
  const hasCarousel = carouselMedia.length > 0;

  if (!hasVideo && !hasImage && !hasCarousel) return null;

  const downloadUrls: string[] = [];
  let mediaType: InstagramMediaType = "image";
  let thumbnail = "";

  if (hasCarousel) {
    mediaType = "carousel";
    for (const media of carouselMedia) {
      const mediaUrls = collectMediaUrls(media);
      if (!mediaUrls) continue;
      downloadUrls.push(...mediaUrls.urls);
      thumbnail ||= mediaUrls.thumbnail;
    }
  } else if (hasVideo) {
    mediaType = "video";
    const url = firstMediaUrl(videoVersions);
    if (url) downloadUrls.push(url);
    thumbnail = firstMediaUrl(imageCandidates) ?? asOptionalString(item["thumbnail_url"]) ?? "";
  } else {
    const url = firstMediaUrl(imageCandidates);
    if (url) downloadUrls.push(url);
    thumbnail = url ?? "";
  }

  if (downloadUrls.length === 0) return null;

  const code = asString(item["code"] || item["shortcode"]);
  const id = asString(item["id"] || item["pk"]);
  const username = asString(
    asRecord(item["user"])?.["username"] ?? asRecord(item["owner"])?.["username"],
  );

  return {
    id,
    code,
    username,
    timestamp: asNumber(item["taken_at"] ?? item["timestamp"]),
    mediaType,
    caption: parseCaption(item["caption"]),
    views: asNumber(item["video_view_count"] ?? item["ig_play_count"] ?? item["view_count"]),
    comments: asNumber(item["comment_count"]),
    likes: asNumber(item["like_count"]),
    duration: asNumber(item["video_duration"]),
    url: buildPostUrl(config.webUrl, code, mediaType),
    downloadUrls,
    thumbnail,
  };
}

export function buildPostUrl(webUrl: string, code: string, mediaType: InstagramMediaType): string {
  if (!code) return "";
  const kind = mediaType === "video" ? "reel" : "p";
  return `${webUrl.replace(/\/+$/, "")}/${kind}/${code}/`;
}

function collectMediaUrls(media: unknown): { urls: string[]; thumbnail: string } | null {
  const record = asRecord(media);
  if (!record) return null;

  const videoUrl = firstMediaUrl(asArray(record["video_versions"]));
  const imageUrl = firstMediaUrl(asArray(asRecord(record["image_versions2"])?.["candidates"]));

  if (videoUrl) return { urls: [videoUrl], thumbnail: imageUrl ?? "" };
  if (imageUrl) return { urls: [imageUrl], thumbnail: imageUrl };
  return null;
}

function parseCaption(value: unknown): string {
  if (typeof value === "string") return value;
  const text = asRecord(value)?.["text"];
  return typeof text === "string" ? text : "No caption available";
}

function firstMediaUrl(versions: unknown[]): string | undefined {
  for (const version of versions) {
    const url = asRecord(version)?.["url"];
    if (typeof url === "string" && url.length > 0) return url;
  }
  return undefined;
}