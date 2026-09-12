import { supabase } from "../supabase";
import { MockInstitution } from "../mock-data";

// Canonical Nigerian Higher Education Directory
export const CANONICAL_INSTITUTIONS: MockInstitution[] = [
  {
    id: "inst-unilag",
    name: "University of Lagos",
    slug: "unilag",
    code: "UNILAG",
    tagline: "In Deed and in Truth • Akoka, Lagos",
  },
  {
    id: "inst-unilorin",
    name: "University of Ilorin",
    slug: "unilorin",
    code: "UNILORIN",
    tagline: "Probitas Doctrina • Ilorin, Kwara",
  },
  {
    id: "inst-unn",
    name: "University of Nigeria, Nsukka",
    slug: "unn",
    code: "UNN",
    tagline: "To Restore the Dignity of Man • Nsukka, Enugu",
  },
  {
    id: "inst-ui",
    name: "University of Ibadan",
    slug: "ui",
    code: "UI",
    tagline: "Recte Sapere Fons • Ibadan, Oyo",
  },
  {
    id: "inst-oau",
    name: "Obafemi Awolowo University",
    slug: "oau",
    code: "OAU",
    tagline: "For Learning and Culture • Ile-Ife, Osun",
  },
  {
    id: "inst-futa",
    name: "Federal University of Technology, Akure",
    slug: "futa",
    code: "FUTA",
    tagline: "Technology for Self Reliance • Akure, Ondo",
  },
];

function getDeletedCampuses(): string[] {
  // Client-side: never filter campuses — the public directory shows all active campuses.
  // SuperAdmin delete/restore updates the JSON file server-side only.
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
  // Default: show all campuses
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
        .map((inst: any) => ({
          id: inst.id,
          name: inst.name,
          slug: inst.slug,
          code: inst.code,
          tagline: inst.tagline || "Higher Education Institution",
          logoUrl: inst.logo_url || inst.logoUrl || `/logos/${inst.slug}.svg`,
        }));
    }
  } catch (error) {
    // Fall through to canonical directory
  }

  return CANONICAL_INSTITUTIONS
    .filter((inst) => !deleted.includes(inst.slug.toLowerCase()))
    .map((inst) => ({
      ...inst,
      logoUrl: inst.logoUrl || `/logos/${inst.slug}.svg`,
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
      return {
        id: dbInst.id,
        name: dbInst.name,
        slug: dbInst.slug,
        code: dbInst.code,
        tagline: dbInst.tagline || "Higher Education Institution",
        logoUrl: dbInst.logo_url || dbInst.logoUrl || `/logos/${dbInst.slug}.svg`,
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
    };
  }

  // Auto-generate dynamic tenant for any custom slug (e.g. /lasu, /covenant, /abu)
  return {
    id: `inst-${cleanSlug}`,
    name: cleanSlug.toUpperCase() + " Campus",
    slug: cleanSlug,
    code: cleanSlug.toUpperCase(),
    tagline: "Higher Education Portal",
    logoUrl: `/logos/${cleanSlug}.svg`,
  };
}
