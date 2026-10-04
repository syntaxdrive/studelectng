"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { CANONICAL_INSTITUTIONS } from "@/lib/db/institutions";

export interface CreateElectionInput {
  institutionSlug: string;
  orgType: "SUG" | "FACULTY" | "DEPARTMENT" | "HALL" | "CLUB";
  orgName: string;
  orgSlug?: string;
  title: string;
  academicSession: string;
  description: string;
  startsAt: string;
  endsAt: string;
  resultsVisibility: "LIVE" | "SEALED_UNTIL_CLOSE";
  authMode: "PIN_SLIP" | "EMAIL_OTP" | "SECRET_MATCH" | "TELEGRAM";
  requireDuesPayment: boolean;
  requireFullTimeOnly: boolean;
  requireGoodDisciplinaryStanding: boolean;
  posts: Array<{
    title: string;
    maxSelections: number;
    allowedLevels: number[];
  }>;
}

export async function createElectionAction(input: CreateElectionInput) {
  try {
    const cleanInstSlug = input.institutionSlug.toLowerCase().trim();
    const institutionId = `inst-${cleanInstSlug}`;

    // 1. Ensure Institution exists
    const canonicalInst = CANONICAL_INSTITUTIONS.find((i) => i.slug === cleanInstSlug);
    await supabase.from("institutions").upsert({
      id: institutionId,
      name: canonicalInst?.name || (cleanInstSlug === "ui" ? "University of Ibadan" : `${cleanInstSlug.toUpperCase()} University`),
      slug: cleanInstSlug,
      code: canonicalInst?.code || cleanInstSlug.toUpperCase(),
      tagline: canonicalInst?.tagline || "Higher Education Institution",
      logo_url: canonicalInst?.logoUrl,
    });

    // 2. Upsert Organization
    const cleanOrgSlug = (input.orgSlug || input.orgName.substring(0, 8))
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    const orgId = `org-${cleanInstSlug}-${cleanOrgSlug}`;

    await supabase.from("organizations").upsert({
      id: orgId,
      institution_id: institutionId,
      name: input.orgName,
      slug: cleanOrgSlug,
      org_type: input.orgType,
      code: cleanOrgSlug.toUpperCase(),
    });

    // 3. Create Election in Supabase
    const electionId = `elec-${cleanOrgSlug}-${Date.now()}`;
    const { error: elecError } = await supabase.from("elections").insert({
      id: electionId,
      organization_id: orgId,
      title: input.title,
      academic_session: input.academicSession,
      description: input.description,
      status: "LIVE",
      results_visibility: input.resultsVisibility,
      auth_mode: input.authMode,
      require_dues_payment: input.requireDuesPayment,
      require_full_time_only: input.requireFullTimeOnly,
      require_good_disciplinary_standing: input.requireGoodDisciplinaryStanding,
      starts_at: new Date(input.startsAt || Date.now()).toISOString(),
      ends_at: new Date(input.endsAt || Date.now() + 7 * 86400000).toISOString(),
    });

    if (elecError) {
      return { success: false, message: elecError.message };
    }

    // 4. Create Contested Posts
    for (let i = 0; i < input.posts.length; i++) {
      const p = input.posts[i];
      await supabase.from("posts").insert({
        id: `post-${cleanOrgSlug}-${i + 1}-${Date.now()}`,
        election_id: electionId,
        title: p.title,
        max_selections: p.maxSelections || 1,
        allowed_levels: p.allowedLevels || [],
        display_order: i,
      });
    }

    revalidatePath(`/${cleanInstSlug}`);
    revalidatePath(`/${cleanInstSlug}/${cleanOrgSlug}`);

    return {
      success: true,
      electionId,
      orgSlug: cleanOrgSlug,
      message: `Election "${input.title}" provisioned successfully on Supabase.`,
    };
  } catch (error: any) {
    console.error("Create election exception:", error);
    return {
      success: false,
      message: error.message || "Failed to create election.",
    };
  }
}

/**
 * Update the organization display picture (DP) / logo
 * Strictly scopes to the specified organization. Never overwrites the institution crest.
 */
export async function updateOrgLogoAction(
  institutionSlug: string,
  logoUrl: string,
  orgSlug?: string
) {
  try {
    const cleanInst = (institutionSlug || "ui").toLowerCase().trim();
    const instId = `inst-${cleanInst}`;

    if (orgSlug) {
      const cleanOrg = orgSlug.toLowerCase().trim();
      await supabase
        .from("organizations")
        .update({ logo_url: logoUrl })
        .eq("institution_id", instId)
        .eq("slug", cleanOrg);

      revalidatePath(`/${cleanInst}/admin`);
      revalidatePath(`/${cleanInst}/${cleanOrg}`);
    } else {
      // Only update institution logo if explicitly no orgSlug is specified (e.g. campus crest by super admin)
      await supabase
        .from("institutions")
        .update({ logo_url: logoUrl })
        .eq("slug", cleanInst);

      revalidatePath(`/${cleanInst}/admin`);
      revalidatePath(`/${cleanInst}`);
    }

    return {
      success: true,
      logoUrl,
      message: "Organization DP updated successfully.",
    };
  } catch (err: any) {
    console.error("updateOrgLogoAction error:", err);
    return { success: false, message: err.message };
  }
}

/**
 * Fetch the organization display picture (DP) / logo
 * Returns null if not found or no custom logo set for this specific org.
 */
export async function getOrgLogoAction(institutionSlug: string, orgSlug: string) {
  try {
    const cleanInst = (institutionSlug || "ui").toLowerCase().trim();
    const cleanOrg = (orgSlug || "").toLowerCase().trim();
    if (!cleanOrg) return { success: true, logoUrl: null };

    const instId = `inst-${cleanInst}`;
    const { data, error } = await supabase
      .from("organizations")
      .select("logo_url")
      .eq("institution_id", instId)
      .eq("slug", cleanOrg)
      .maybeSingle();

    if (error) {
      console.warn("getOrgLogoAction error:", error.message);
      return { success: false, logoUrl: null };
    }

    return { success: true, logoUrl: data?.logo_url || null };
  } catch (err: any) {
    console.error("getOrgLogoAction error:", err);
    return { success: false, logoUrl: null };
  }
}

