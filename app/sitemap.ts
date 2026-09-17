import { MetadataRoute } from "next";

const BASE_URL = "https://studelect.com.ng";

// Known campus slugs — expanded dynamically in production
const CAMPUS_SLUGS = ["ui", "unilag", "oau", "unn", "abu", "futa", "uniben"];

// Known org slugs per campus
const ORG_SLUGS: Record<string, string[]> = {
  ui: ["nesa", "sug"],
  unilag: ["nacos", "sug"],
  oau: ["sug"],
  unn: ["sug"],
  abu: ["sug"],
  futa: ["sug"],
  uniben: ["sug"],
};

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/admin/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/cookies`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Campus landing pages
  const campusRoutes: MetadataRoute.Sitemap = CAMPUS_SLUGS.map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Voter booth pages (public)
  const boothRoutes: MetadataRoute.Sitemap = CAMPUS_SLUGS.flatMap((campus) =>
    (ORG_SLUGS[campus] || []).map((org) => ({
      url: `${BASE_URL}/${campus}/${org}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    }))
  );

  return [...staticRoutes, ...campusRoutes, ...boothRoutes];
}
