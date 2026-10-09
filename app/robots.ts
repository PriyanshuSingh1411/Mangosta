import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/app/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private pages and the API have nothing for search engines.
      disallow: ["/admin", "/api/", "/account", "/checkout", "/orders", "/bag"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
