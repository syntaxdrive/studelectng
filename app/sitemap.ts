import { MetadataRoute } from "next";
import { CANONICAL_INSTITUTIONS } from "@/lib/db/institutions";
import { supabase } from "@/lib/supabase";

const BASE_URL = "https://studelect.com.ng";

// Baseline associations map ensuring guaranteed coverage for SEO
const DEFAULT_CAMPUS_ORGS: Record<string, string[]> = {
  ui: ["nesa", "renarsa", "sug"],
  unilag: ["nacos", "sug"],
  oau: ["sug"],
  unn: ["sug"],
  abu: ["sug"],
  futa: ["sug"],
  uniben: ["sug"],
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 1. Static high-authority routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/legal/cookies`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  // 2. Discover Campuses (Database + Canonical)
  const campusSlugsSet = new Set<string>(
    CANONICAL_INSTITUTIONS.map((inst) => inst.slug.toLowerCase().trim())
  );

  try {
    const { data: dbCampuses } = await supabase
      .from("institutions")
      .select("slug, updated_at");
    if (dbCampuses && Array.isArray(dbCampuses)) {
      for (const camp of dbCampuses) {
        if (camp.slug) {
          campusSlugsSet.add(camp.slug.toLowerCase().trim());
        }
      }
    }
  } catch (_) {}

  const campusRoutes: MetadataRoute.Sitemap = Array.from(campusSlugsSet).map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  // 3. Discover Organizations per Campus (Database + Default map)
  const orgPairsSet = new Set<string>();

  // Add default known associations
  for (const [campus, orgs] of Object.entries(DEFAULT_CAMPUS_ORGS)) {
    for (const org of orgs) {
      orgPairsSet.add(`${campus.toLowerCase()}/${org.toLowerCase()}`);
    }
  }

  // Add associations from Supabase if reachable
  try {
    const { data: dbOrgs } = await supabase
      .from("organizations")
      .select("slug, institution_id, updated_at");

    if (dbOrgs && Array.isArray(dbOrgs)) {
      for (const o of dbOrgs) {
        const instSlug = (o.institution_id || "").replace(/^inst-/, "").toLowerCase();
        const orgSlug = (o.slug || "").toLowerCase();
        if (instSlug && orgSlug) {
          orgPairsSet.add(`${instSlug}/${orgSlug}`);
        }
      }
    }
  } catch (_) {}

  const associationRoutes: MetadataRoute.Sitemap = Array.from(orgPairsSet).map((pair) => ({
    url: `${BASE_URL}/${pair}`,
    lastModified: now,
    changeFrequency: "hourly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...campusRoutes, ...associationRoutes];
}
