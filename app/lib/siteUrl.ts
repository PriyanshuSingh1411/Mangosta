/**
 * The site's absolute address, for links in emails, page metadata, the
 * sitemap and robots.txt: NEXT_PUBLIC_SITE_URL if set, otherwise Vercel's
 * production address. No database import, so any file can use it.
 */
export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    "https://mangosta.vercel.app";

  return configured.replace(/\/+$/, "");
}
