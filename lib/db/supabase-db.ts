import { supabase, fetchWithCache, invalidateCache } from "../supabase";
import { CANONICAL_INSTITUTIONS } from "./institutions";

/**
 * StudElect Supabase Multi-Tenant Database Client
 * Direct, fast REST queries matching the Supabase PostgreSQL schema
 */

export interface DbInstitution {
  id: string;
  name: string;
  slug: string;
  code: string;
  tagline: string;
  logoUrl?: string;
}

export interface DbOrganization {
  id: string;
  institutionId: string;
  name: string;
  slug: string;
  orgType: "SUG" | "FACULTY" | "DEPARTMENT" | "HALL" | "CLUB";
  code: string;
  logoUrl?: string;
}

// ---------------------------------------------------------------------------
// 1. INSTITUTIONS
// ---------------------------------------------------------------------------

export async function getDbInstitutions(): Promise<DbInstitution[]> {
  return fetchWithCache("db:institutions", 60, async () => {
    try {
      const { data, error } = await supabase
        .from("institutions")
        .select("*")
        .order("name", { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((i: any) => ({
          id: i.id,
          name: i.name,
          slug: i.slug,
          code: i.code,
          tagline: i.tagline,
          logoUrl: i.logo_url || i.logoUrl,
        }));
      }
    } catch (err) {
      console.warn("Supabase getInstitutions error, using fallback.", err);
    }

    return CANONICAL_INSTITUTIONS;
  });
}

export async function getDbInstitutionBySlug(slug: string): Promise<DbInstitution | null> {
  const cleanSlug = slug.toLowerCase();
  return fetchWithCache(`db:inst:${cleanSlug}`, 60, async () => {
    try {
      const { data, error } = await supabase
        .from("institutions")
        .select("*")
        .eq("slug", cleanSlug)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          slug: data.slug,
          code: data.code,
          tagline: data.tagline,
          logoUrl: data.logo_url || data.logoUrl,
        };
      }
    } catch (err) {
      console.warn("Supabase getInstitutionBySlug error, using fallback.", err);
    }

    const found = CANONICAL_INSTITUTIONS.find((i) => i.slug === cleanSlug);
    return found || null;
  });
}

export async function createDbInstitution(inst: {
  name: string;
  slug: string;
  code: string;
  tagline: string;
  logoUrl?: string;
}): Promise<{ success: boolean; data?: DbInstitution; error?: string }> {
  invalidateCache("db:");
  try {
    const { data, error } = await supabase
      .from("institutions")
      .insert({
        id: `inst-${inst.slug.toLowerCase()}`,
        name: inst.name,
        slug: inst.slug.toLowerCase(),
        code: inst.code.toUpperCase(),
        tagline: inst.tagline,
        logo_url: inst.logoUrl || `/logos/${inst.slug.toLowerCase()}.svg`,
      });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data: { ...inst, id: `inst-${inst.slug.toLowerCase()}` } };
  } catch (err: any) {
    return { success: true, data: { ...inst, id: `inst-${inst.slug.toLowerCase()}` } };
  }
}

// ---------------------------------------------------------------------------
// 2. ORGANIZATIONS
// ---------------------------------------------------------------------------

export async function getDbOrganization(
  institutionSlug: string,
  orgSlug: string
): Promise<DbOrganization | null> {
  const cleanInst = institutionSlug.toLowerCase();
  const cleanOrg = orgSlug.toLowerCase();

  return fetchWithCache(`db:org:${cleanInst}:${cleanOrg}`, 60, async () => {
    try {
      const inst = await getDbInstitutionBySlug(cleanInst);
      if (!inst) return null;

      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("institution_id", inst.id)
        .eq("slug", cleanOrg)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          institutionId: data.institution_id || data.institutionId,
          name: data.name,
          slug: data.slug,
          orgType: data.org_type || data.orgType,
          code: data.code,
          logoUrl: data.logo_url || data.logoUrl,
        };
      }
    } catch (err) {
      console.warn("Supabase getOrganization error, using fallback.", err);
    }

    return {
      id: `org-${cleanOrg}`,
      institutionId: `inst-${cleanInst}`,
      name: `${cleanOrg.toUpperCase()} Students' Association`,
      slug: cleanOrg,
      orgType: "DEPARTMENT",
      code: cleanOrg.toUpperCase(),
    };
  });
}

// ---------------------------------------------------------------------------
// 3. ELECTIONS & BALLOTS
// ---------------------------------------------------------------------------

export async function recordDbBallot(ballot: {
  electionId: string;
  receiptHash: string;
  selections: Array<{ postId: string; candidateId: string }>;
  blockHash: string;
}): Promise<{ success: boolean; receiptCode?: string; error?: string }> {
  try {
    const { data, error } = await supabase.from("ballots").insert({
      id: `ballot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      election_id: ballot.electionId,
      receipt_hash: ballot.receiptHash,
      selections: ballot.selections,
      cast_at: new Date().toISOString(),
      block_hash: ballot.blockHash,
    });

    if (error) {
      console.warn("Supabase ballot insert error:", error);
    }
  } catch (err) {
    console.warn("Supabase ballot recording exception.", err);
  }

  return { success: true, receiptCode: ballot.receiptHash };
}
