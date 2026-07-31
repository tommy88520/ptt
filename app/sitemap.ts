import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  return [
    { url: baseUrl, changeFrequency: "hourly", priority: 1 },
    { url: `${baseUrl}/subscriptions`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
