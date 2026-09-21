import { supabase } from "../supabase";
import { MockInstitution } from "../mock-data";

// Canonical Nigerian Higher Education Directory
export const CANONICAL_INSTITUTIONS: MockInstitution[] = [
  {
    id: "inst-ui",
    name: "University of Ibadan",
    slug: "ui",
    code: "UI",
    tagline: "Recte Sapere Fons • Ibadan, Oyo",
    logoUrl: "/logos/ui.jpg",
    coverImageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "inst-unilag",
    name: "University of Lagos",
    slug: "unilag",
    code: "UNILAG",
    tagline: "In Deed and in Truth • Akoka, Lagos",
    logoUrl: "/logos/unilag.png",
    coverImageUrl: "https://images.unsplash.com/photo-1562774053-701939374585?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "inst-uniben",
    name: "University of Benin",
    slug: "uniben",
    code: "UNIBEN",
    tagline: "Knowledge for Service • Ugbowo & Ekehuan, Edo",
    logoUrl: "/logos/uniben.jpg",
    coverImageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "inst-oau",
    name: "Obafemi Awolowo University",
    slug: "oau",
    code: "OAU",
    tagline: "For Learning and Culture • Ile-Ife, Osun",
    logoUrl: "/logos/oau.jpg",
    coverImageUrl: "https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "inst-unilorin",
    name: "University of Ilorin",
    slug: "unilorin",
    code: "UNILORIN",
    tagline: "Probitas Doctrina • Ilorin, Kwara",
    logoUrl: "/logos/unilorin.jpg",
    coverImageUrl: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "inst-unn",
    name: "University of Nigeria, Nsukka",
    slug: "unn",
    code: "UNN",
    tagline: "To Restore the Dignity of Man • Nsukka, Enugu",
    logoUrl: "/logos/unn.jpg",
    coverImageUrl: "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1200&auto=format&fit=crop&q=80",
  },
  {
    id: "inst-futa",
    name: "Federal University of Technology, Akure",
    slug: "futa",
    code: "FUTA",
    tagline: "Technology for Self Reliance • Akure, Ondo",
    logoUrl: "/logos/futa.png",
    coverImageUrl: "https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=1200&auto=format&fit=crop&q=80",
  },
];

function getDeletedCampuses(): string[] {
  if (typeof window !== "undefined") {
    return [];
  }
  try {
    const fs = eval("require")("fs");
    const path = eval("require")("path");
    const file = path.join(process.cwd(), "data", "deleted-campuses-store.json");
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {}
  return [];
}

export async function getInstitutions(): Promise<MockInstitution[]> {
  const deleted = getDeletedCampuses();

  try {
    const { data, error } = await supabase
      .from("institutions")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data && data.length > 0) {
      return data
        .filter((inst: any) => {
          const cleanSlug = (inst.slug || "").toLowerCase().trim();
          const cleanId = (inst.id || "").toLowerCase().trim().replace(/^inst-/, "");
          return !deleted.includes(cleanSlug) && !deleted.includes(cleanId);
        })
        .map((inst: any) => {
          const canonical = CANONICAL_INSTITUTIONS.find(
            (c) => c.slug.toLowerCase() === (inst.slug || "").toLowerCase()
          );
          const dbLogo = inst.logo_url || inst.logoUrl;
          const isPlaceholderSvg = !dbLogo || dbLogo.endsWith('.svg');
          const logoUrl = (isPlaceholderSvg && canonical?.logoUrl) ? canonical.logoUrl : (dbLogo || canonical?.logoUrl || `/logos/${inst.slug}.svg`);

          return {
            id: inst.id,
            name: inst.name,
            slug: inst.slug,
            code: inst.code,
            tagline: inst.tagline || "Higher Education Institution",
            logoUrl,
            coverImageUrl: inst.cover_image_url || inst.coverImageUrl || canonical?.coverImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80",
          };
        });
    }
  } catch (error) {
    // Fall through to canonical directory
  }

  return CANONICAL_INSTITUTIONS
    .filter((inst) => !deleted.includes(inst.slug.toLowerCase()))
    .map((inst) => ({
      ...inst,
      logoUrl: inst.logoUrl || `/logos/${inst.slug}.svg`,
      coverImageUrl: inst.coverImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80",
    }));
}

export async function getInstitutionBySlug(slug?: string): Promise<MockInstitution | null> {
  const cleanSlug = (slug || "ui").toLowerCase().trim();

  try {
    const { data: dbInst, error } = await supabase
      .from("institutions")
      .select("*")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (!error && dbInst) {
      const canonical = CANONICAL_INSTITUTIONS.find((i) => i.slug.toLowerCase() === cleanSlug);
      const dbLogo = dbInst.logo_url || dbInst.logoUrl;
      const isPlaceholderSvg = !dbLogo || dbLogo.endsWith('.svg');
      const logoUrl = (isPlaceholderSvg && canonical?.logoUrl) ? canonical.logoUrl : (dbLogo || canonical?.logoUrl || `/logos/${dbInst.slug}.svg`);

      return {
        id: dbInst.id,
        name: dbInst.name,
        slug: dbInst.slug,
        code: dbInst.code,
        tagline: dbInst.tagline || "Higher Education Institution",
        logoUrl,
        coverImageUrl: dbInst.cover_image_url || dbInst.coverImageUrl || canonical?.coverImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80",
      };
    }
  } catch (error) {
    // DB not reachable, fall through to canonical lookup
  }

  // Look up in canonical Nigerian institutions directory
  const canonical = CANONICAL_INSTITUTIONS.find(
    (i) => i.slug.toLowerCase() === cleanSlug
  );

  if (canonical) {
    return {
      ...canonical,
      logoUrl: canonical.logoUrl || `/logos/${canonical.slug}.svg`,
      coverImageUrl: canonical.coverImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80",
    };
  }

  return {
    id: `inst-${cleanSlug}`,
    name: cleanSlug.toUpperCase() + " Campus",
    slug: cleanSlug,
    code: cleanSlug.toUpperCase(),
    tagline: "Higher Education Portal",
    logoUrl: `/logos/${cleanSlug}.svg`,
    coverImageUrl: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80",
  };
}
