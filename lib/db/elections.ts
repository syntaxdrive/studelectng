import { supabase } from "../supabase";
import { MOCK_ELECTIONS, MockElection } from "../mock-data";

export async function getElectionsByInstitution(institutionSlug?: string): Promise<MockElection[]> {
  const cleanInstSlug = (institutionSlug || "ui").toLowerCase().trim();

  try {
    // 1. Get institution id
    const { data: inst } = await supabase
      .from("institutions")
      .select("id")
      .eq("slug", cleanInstSlug)
      .maybeSingle();

    if (inst) {
      // 2. Query elections for organizations under this institution
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name, org_type")
        .eq("institution_id", inst.id);

      if (orgs && orgs.length > 0) {
        const orgIds = orgs.map((o: any) => o.id);
        const { data: dbElections } = await supabase
          .from("elections")
          .select("*")
          .order("starts_at", { ascending: false });

        if (dbElections && dbElections.length > 0) {
          const filtered = dbElections.filter((e: any) => orgIds.includes(e.organization_id));
          if (filtered.length > 0) {
            return filtered.map((e: any) => {
              const matchedOrg = orgs.find((o: any) => o.id === e.organization_id);
              return {
                id: e.id,
                orgId: e.organization_id,
                orgName: matchedOrg?.name || "Students' Association",
                orgType: matchedOrg?.org_type || "DEPARTMENT",
                title: e.title,
                academicSession: e.academic_session || "2025/2026",
                description: e.description || "",
                status: e.status || "LIVE",
                resultsVisibility: e.results_visibility || "LIVE",
                authMode: e.auth_mode || "PIN_SLIP",
                requireDuesPayment: e.require_dues_payment !== false,
                requireFullTimeOnly: e.require_full_time_only !== false,
                requireGoodDisciplinaryStanding: e.require_good_disciplinary_standing !== false,
                startsAt: e.starts_at || new Date().toISOString(),
                endsAt: e.ends_at || new Date(Date.now() + 7 * 86400000).toISOString(),
                totalRegisteredVoters: 0,
                totalAccreditedVoters: 0,
                totalBallotsCast: 0,
                posts: [],
              };
            });
          }
        }
      }
    }
  } catch (error) {
    console.warn("Error fetching elections by institution:", error);
  }

  return MOCK_ELECTIONS;
}
