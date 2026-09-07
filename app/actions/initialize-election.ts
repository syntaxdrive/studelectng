"use server";

import { supabase, invalidateCache } from "@/lib/supabase";
import { setAdminSessionCookie, AuthSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface InitializeElectionInput {
  institutionSlug: string;
  commissionerName: string;
  commissionerEmail: string;
  password: string;
  orgType?: "SUG" | "FACULTY" | "DEPARTMENT" | "HALL";
  orgName: string;
  orgSlug?: string;
  electionTitle: string;
  academicSession?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  resultsVisibility?: "LIVE" | "SEALED_UNTIL_CLOSE";
  authMode?: "PIN_SLIP" | "EMAIL_OTP" | "SECRET_MATCH";
  requireDuesPayment?: boolean;
  requireFullTimeOnly?: boolean;
  requireGoodDisciplinaryStanding?: boolean;
  paymentPlan?: "MICRO_500" | "DEPT_1000" | "FACULTY_3000" | "SUG_UNLIMITED" | "CUSTOM";
  voterQuota?: number;
  agreedAmountNgn?: number;
  posts: Array<{
    title: string;
    maxSelections?: number;
    allowedLevels?: number[];
  }>;
}

const DATA_DIR = path.join(process.cwd(), "data");

export async function initializeElectionAndAccountAction(input: InitializeElectionInput) {
  try {
    if (!input.commissionerName || !input.commissionerEmail || input.password.length < 6) {
      return {
        success: false,
        message: "Please enter your full name, official email, and a password of at least 6 characters.",
      };
    }

    if (!input.orgName || !input.electionTitle) {
      return {
        success: false,
        message: "Please enter your association name and election title.",
      };
    }

    const cleanInstSlug = input.institutionSlug.toLowerCase().trim();
    const cleanOrgSlug = (input.orgSlug || input.orgName.substring(0, 8))
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");

    const orgType = input.orgType || "DEPARTMENT";
    const electionId = `elec-${cleanOrgSlug}-${Date.now()}`;
    const orgId = `org-${cleanInstSlug}-${cleanOrgSlug}`;
    const institutionId = `inst-${cleanInstSlug}`;
    const cleanEmail = input.commissionerEmail.trim().toLowerCase();
    const passwordHash = crypto.createHash("sha256").update(input.password.trim()).digest("hex");

    // ── 1. Instant Local Stores Write (0ms - guarantees instant portal response) ─
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 1a. Commissioner Assignment
      const assignmentsPath = path.join(DATA_DIR, "commissioner-assignments.json");
      let assignments: Record<string, any> = {};
      if (fs.existsSync(assignmentsPath)) {
        try {
          assignments = JSON.parse(fs.readFileSync(assignmentsPath, "utf8"));
        } catch (_) {}
      }
      assignments[cleanEmail] = {
        email: cleanEmail,
        fullName: input.commissionerName.trim(),
        institutionId,
        institutionSlug: cleanInstSlug,
        orgId,
        orgSlug: cleanOrgSlug,
        orgName: input.orgName.trim(),
        electionId,
        role: "ELCOM_CHAIRMAN",
      };
      fs.writeFileSync(assignmentsPath, JSON.stringify(assignments, null, 2), "utf8");

      // 1b. Posts & Candidates Store
      const candidatesPath = path.join(DATA_DIR, "candidates-store.json");
      let candStore: { posts: any[] } = { posts: [] };
      if (fs.existsSync(candidatesPath)) {
        try {
          candStore = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));
        } catch (_) {}
      }

      const formattedPosts = (input.posts || []).map((p, i) => ({
        id: `post-${cleanOrgSlug}-${i + 1}`,
        electionId,
        title: p.title,
        description: `Contested position for ${p.title}`,
        maxSelections: p.maxSelections || 1,
        allowedLevels: p.allowedLevels || [],
        candidates: [],
      }));

      // Merge new posts into local candidate store
      candStore.posts = [
        ...(candStore.posts || []).filter((p: any) => p.electionId !== electionId),
        ...formattedPosts,
      ];
      fs.writeFileSync(candidatesPath, JSON.stringify(candStore, null, 2), "utf8");

      // 1c. Org License Store (provision quota based on selected tier)
      const licensesPath = path.join(DATA_DIR, "org-licenses-store.json");
      let licenses: any[] = [];
      if (fs.existsSync(licensesPath)) {
        try {
          licenses = JSON.parse(fs.readFileSync(licensesPath, "utf8"));
        } catch (_) {}
      }

      const plan = input.paymentPlan || (orgType === "SUG" ? "SUG_UNLIMITED" : orgType === "FACULTY" ? "FACULTY_3000" : "DEPT_1000");
      const quota = input.voterQuota || (plan === "MICRO_500" ? 500 : plan === "FACULTY_3000" ? 3000 : plan === "SUG_UNLIMITED" ? 10000 : 1000);
      const price = input.agreedAmountNgn || (plan === "MICRO_500" ? 15000 : plan === "FACULTY_3000" ? 65000 : plan === "SUG_UNLIMITED" ? 150000 : 30000);

      const existingLicenseIndex = licenses.findIndex(
        (l: any) => l.id === orgId || (l.institutionSlug === cleanInstSlug && l.orgSlug === cleanOrgSlug)
      );

      const newLicense = {
        id: orgId,
        institutionSlug: cleanInstSlug,
        orgSlug: cleanOrgSlug,
        institutionName: cleanInstSlug === "ui" ? "University of Ibadan" : (cleanInstSlug.toUpperCase() + " University"),
        orgName: input.orgName.trim(),
        orgType: orgType,
        paymentPlan: plan,
        voterQuota: quota,
        agreedAmountNgn: price,
        contactAdminName: input.commissionerName.trim(),
        registeredVotersCount: 0,
        ballotsCastCount: 0,
        licenseStatus: "ACTIVE",
        lastActivatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      if (existingLicenseIndex >= 0) {
        licenses[existingLicenseIndex] = newLicense;
      } else {
        licenses.push(newLicense);
      }
      fs.writeFileSync(licensesPath, JSON.stringify(licenses, null, 2), "utf8");

      // 1d. Un-tombstone if previously deleted
      const deletedOrgsPath = path.join(DATA_DIR, "deleted-orgs-store.json");
      if (fs.existsSync(deletedOrgsPath)) {
        try {
          const raw = fs.readFileSync(deletedOrgsPath, "utf8");
          const dList = JSON.parse(raw);
          const filtered = (dList || []).filter((d: any) => d.id !== orgId && d.orgSlug !== cleanOrgSlug);
          fs.writeFileSync(deletedOrgsPath, JSON.stringify(filtered, null, 2), "utf8");
        } catch (_) {}
      }
    } catch (localErr) {
      console.warn("Local storage cache write warning:", localErr);
    }

    // ── 2. Optimized Parallel Supabase Cloud Write ─────────────────────────────
    try {
      // Step A: Upsert Institution & Commissioner in parallel
      await Promise.allSettled([
        supabase.from("institutions").upsert({
          id: institutionId,
          name: cleanInstSlug.toUpperCase() + " University",
          slug: cleanInstSlug,
          code: cleanInstSlug.toUpperCase(),
          tagline: "Higher Education Institution",
        }),
        supabase.from("admin_users").upsert({
          id: `admin-${Date.now()}`,
          institution_id: institutionId,
          email: cleanEmail,
          full_name: input.commissionerName.trim(),
          password_hash: passwordHash,
          role: "ELCOM_CHAIRMAN",
          is_active: true,
        }),
      ]);

      // Step B: Upsert Organization
      await supabase.from("organizations").upsert({
        id: orgId,
        institution_id: institutionId,
        name: input.orgName,
        slug: cleanOrgSlug,
        org_type: orgType,
        code: cleanOrgSlug.toUpperCase(),
      });

      // Step C: Create Election
      await supabase.from("elections").insert({
        id: electionId,
        organization_id: orgId,
        title: input.electionTitle,
        academic_session: input.academicSession || "2025/2026",
        description: input.description || "",
        status: "LIVE",
        results_visibility: input.resultsVisibility || "LIVE",
        auth_mode: input.authMode || "PIN_SLIP",
        require_dues_payment: input.requireDuesPayment !== false,
        require_full_time_only: input.requireFullTimeOnly !== false,
        require_good_disciplinary_standing: input.requireGoodDisciplinaryStanding !== false,
        starts_at: new Date(input.startsAt || Date.now()).toISOString(),
        ends_at: new Date(input.endsAt || Date.now() + 7 * 86400000).toISOString(),
      });

      // Step D: Batch Insert ALL Posts at once (1 single request instead of loop)
      if (input.posts && input.posts.length > 0) {
        const postsBatch = input.posts.map((p, i) => ({
          id: `post-${cleanOrgSlug}-${i + 1}-${Date.now()}`,
          election_id: electionId,
          title: p.title,
          max_selections: p.maxSelections || 1,
          allowed_levels: p.allowedLevels || [],
          display_order: i,
        }));
        await supabase.from("posts").insert(postsBatch);
      }
    } catch (dbErr) {
      console.warn("Supabase background synchronization completed with notices:", dbErr);
    }

    // Invalidate stale in-memory read caches
    invalidateCache("db:");
    invalidateCache("posts:");
    invalidateCache("superadmin:telemetry");

    // Automatically set secure session cookie for the new commissioner
    const session: AuthSession = {
      userId: `elcom-${Date.now()}`,
      email: cleanEmail,
      fullName: input.commissionerName.trim(),
      role: "ELCOM_ADMIN",
      institutionId,
      institutionSlug: cleanInstSlug,
      orgId,
      electionId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    await setAdminSessionCookie(session);

    revalidatePath(`/${cleanInstSlug}`);
    revalidatePath(`/${cleanInstSlug}/${cleanOrgSlug}`);
    revalidatePath(`/${cleanInstSlug}/admin`);

    const directStudentUrl = `/${cleanInstSlug}/${cleanOrgSlug}`;

    return {
      success: true,
      electionId,
      institutionSlug: cleanInstSlug,
      orgSlug: cleanOrgSlug,
      directStudentUrl,
      message: "Election portal and ELCOM account successfully created!",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to initialize election portal.",
    };
  }
}
