import "server-only";

// Customer review photos are uploaded by /api/reviews/upload into one folder
// of the store's own Cloudinary account. A review may only use photos from
// there, so it can't point at images hosted anywhere else (including other
// people's Cloudinary accounts).

export const REVIEW_PHOTO_FOLDER = "mangosta/reviews";

/** Uploads one customer may make per day (India time); a review holds up to 3. */
export const REVIEW_PHOTO_UPLOADS_PER_DAY = 15;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True for a photo uploaded by /api/reviews/upload to this store's
 * Cloudinary account, e.g.
 * https://res.cloudinary.com/<cloud>/image/upload/v1712345678/mangosta/reviews/abc123.jpg
 */
export function isStoreReviewPhotoUrl(url: string): boolean {
  const cloud = String(process.env.CLOUDINARY_CLOUD_NAME ?? "").trim();
  if (!cloud) return false;

  const pattern = new RegExp(
    `^https://res\\.cloudinary\\.com/${escapeRegExp(cloud)}/image/upload/(?:v\\d+/)?${escapeRegExp(REVIEW_PHOTO_FOLDER)}/[A-Za-z0-9_-]+\\.[A-Za-z0-9]{2,5}$`
  );
  return url.length <= 300 && pattern.test(url);
}
