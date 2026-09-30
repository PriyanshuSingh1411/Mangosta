import type { MetadataRoute } from "next";
import { getAllProducts } from "@/app/data/products";

const SITE_URL = "https://mangosta.example.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProducts();

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/product/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/shop`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...productEntries,
  ];
}
