import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { listDates } from "@/lib/storage/editions";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/financiero`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/prensa-general`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/archivo`, changeFrequency: "daily", priority: 0.7 },
  ];

  let historicalRoutes: MetadataRoute.Sitemap = [];
  try {
    const financialDates = listDates("financial").map((fecha) => ({
      url: `${SITE_URL}/financiero/${fecha}`,
      changeFrequency: "never" as const,
      priority: 0.5,
    }));
    const generalDates = listDates("general").map((fecha) => ({
      url: `${SITE_URL}/prensa-general/${fecha}`,
      changeFrequency: "never" as const,
      priority: 0.5,
    }));
    historicalRoutes = [...financialDates, ...generalDates];
  } catch {
    historicalRoutes = [];
  }

  return [...staticRoutes, ...historicalRoutes];
}
