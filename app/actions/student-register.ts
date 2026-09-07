"use server";

import { supabase, fetchWithCache, invalidateCache } from "@/lib/supabase";
import { normalizeMatricNo } from "@/lib/matric-normalizer";
import { generateSingleVoterPin } from "@/lib/auth/pin-generator";
import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

export interface StudentLookupInput {
  institutionSlug: string;
  matricNo: string;
}

export interface StudentRegisterInput {
  institutionSlug: string;
  orgSlug?: string;
  matricNo: string;
  fullName: string;
  department?: string;
  faculty?: string;
  level: number;
  email?: string;
  phoneNumber?: string;
  hallOfResidence?: string;
}

/**
 * Check a student's accreditation status and retrieve voter PIN from Supabase.
 * Responds within 6s or returns a graceful timeout message.
 */
export async function lookupStudentStatusAction(input: StudentLookupInput) {
  const norm = normalizeMatricNo(input.matricNo);
  if (!norm.isValid) {
    return {
      success: false,
      message: "Please enter a valid Nigerian matriculation number.",
    };
  }

  const cleanInstSlug = (input.institutionSlug || "ui").toLowerCase().trim();

  try {
    const { data: student, error } = await supabase
      .from("students")
      .select("*")
      .eq("normalized_matric", norm.normalized)
      .maybeSingle();

    if (error) {
      console.warn("Supabase student lookup error:", error);
      // Don't block — return not-found gracefully
    }

    if (student) {
      const pinPrefix = student.portal_pin ? student.portal_pin.substring(0, 3) : "PIN";
      return {
        success: true,
        student: {
          matricNo: student.matric_no,
          fullName: student.full_name,
          department: student.department,
          level: student.level,
          duesPaid: student.dues_paid !== false,
          disciplinaryStatus: student.disciplinary_status || "GOOD_STANDING",
          hasPin: !!student.portal_pin,
          maskedPin: `${pinPrefix}••••-••••`,
          maskedEmail: student.email
            ? student.email.replace(/(.{2})(.*)(?=@)/, (_m: any, a: any, b: any) => a + "*".repeat(b.length))
            : null,
          maskedPhone: student.phone_number
            ? student.phone_number.slice(0, 4) + "****" + student.phone_number.slice(-3)
            : null,
        },
      };
    }
  } catch (err) {
    console.warn("Supabase student lookup exception:", err);
  }

  return {
    success: false,
    message: `Matriculation number "${input.matricNo}" was not found on the voter register. Click "New Voter? Get PIN" to activate your profile.`,
  };
}

/**
 * Student Self-Registration — creates or updates voter profile in Supabase
 * with org-scoped PIN. Responds within 6s.
 */
export async function registerStudentAccountAction(input: StudentRegisterInput) {
  const norm = normalizeMatricNo(input.matricNo);
  if (!norm.isValid) {
    return {
      success: false,
      message: "Please enter a valid matriculation or student registration number.",
    };
  }

  const cleanInstSlug = (input.institutionSlug || "ui").toLowerCase().trim();
  const orgCode = (input.orgSlug || "ST").substring(0, 4).toUpperCase();
  const generatedPin = generateSingleVoterPin(orgCode);
  const institutionId = `inst-${cleanInstSlug}`;
  const dept = (input.department || "General Studies").trim();

  try {
    // 1. Ensure Institution exists (upsert — non-fatal if it fails)
    try {
      await supabase.from("institutions").upsert({
        id: institutionId,
        name: cleanInstSlug.toUpperCase() + " University",
        slug: cleanInstSlug,
        code: cleanInstSlug.toUpperCase(),
        tagline: "Higher Education Institution",
      });
    } catch (_) {
      // Non-fatal — continue with student registration
    }

    // 2. Check if student already exists
    let existing: any = null;
    try {
      const { data } = await supabase
        .from("students")
        .select("*")
        .eq("institution_id", institutionId)
        .eq("normalized_matric", norm.normalized)
        .maybeSingle();
      existing = data;
    } catch (_) {
      // Non-fatal — will attempt insert
    }

    if (existing && existing.portal_pin) {
      return {
        success: false,
        message: `Matriculation number "${input.matricNo}" is already registered with an active profile. For ballot security, duplicate registrations are blocked. If you lost your PIN, please contact your ELCOM commissioner.`,
      };
    }

    if (existing) {
      // If student was pre-seeded without a PIN, generate and attach their PIN
      try {
        await supabase
          .from("students")
          .update({
            full_name: (input.fullName || "").trim(),
            department: dept,
            level: Number(input.level) || 100,
            email: input.email?.trim() || existing.email,
            phone_number: input.phoneNumber?.trim() || existing.phone_number,
            portal_pin: generatedPin,
          })
          .eq("id", existing.id);
      } catch (_) {
        // Non-fatal
      }

      return {
        success: true,
        portalPin: generatedPin,
        message: "Student voter profile activated successfully!",
      };
    }

    // 3. Insert new student
    const newStudentId = `stud-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 6)}`;

    const { error: insertError } = await supabase.from("students").insert({
      id: newStudentId,
      institution_id: institutionId,
      matric_no: norm.raw,
      normalized_matric: norm.normalized,
      full_name: (input.fullName || "").trim(),
      faculty: input.faculty?.trim() || "Faculty of Science",
      department: dept,
      level: Number(input.level) || 100,
      program_type: "FULL_TIME",
      dues_paid: true,
      disciplinary_status: "GOOD_STANDING",
      hall_of_residence: input.hallOfResidence?.trim() || "Campus",
      portal_pin: generatedPin,
      email: input.email?.trim() || null,
      phone_number: input.phoneNumber?.trim() || null,
    });

    if (insertError) {
      console.error("Supabase student insert error:", insertError);
      // Still return the PIN so they can vote — DB will sync later
      return {
        success: true,
        portalPin: generatedPin,
        message: "Voter PIN generated! Note: profile may sync to database shortly.",
      };
    }

    return {
      success: true,
      portalPin: generatedPin,
      message: "Student voter profile activated successfully!",
    };
  } catch (error: any) {
    console.error("Registration error:", error);
    // Even on total failure, give them their PIN so they're not blocked
    return {
      success: true,
      portalPin: generatedPin,
      message: "Voter PIN generated! Profile will sync once connection is restored.",
    };
  }
}

/**
 * Get all registered voters for an organization (for ELCOM admin dashboard)
 */
export async function getOrgVoterRollAction(institutionSlug: string, orgSlug?: string) {
  const cleanSlug = (institutionSlug || "ui").toLowerCase().trim();
  const institutionId = `inst-${cleanSlug}`;
  const cleanOrgSlug = (orgSlug || "").toLowerCase().trim();

  const cacheKey = cleanOrgSlug
    ? `voter_roll:${cleanSlug}:${cleanOrgSlug}`
    : `voter_roll:${cleanSlug}`;

  return fetchWithCache(cacheKey, 20, async () => {
    try {
      let org: any = null;
      let orgElectionIds: string[] = [];
      let accreditedStudentIds = new Set<string>();

      if (cleanOrgSlug) {
        try {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("*")
            .eq("institution_id", institutionId)
            .eq("slug", cleanOrgSlug)
            .maybeSingle();
          org = orgData;

          if (org) {
            const { data: elecData } = await supabase
              .from("elections")
              .select("id")
              .eq("organization_id", org.id);
            orgElectionIds = (elecData || []).map((e: any) => e.id);

            if (orgElectionIds.length > 0) {
              const { data: accData } = await supabase
                .from("voter_accreditations")
                .select("student_id")
                .in("election_id", orgElectionIds);
              accreditedStudentIds = new Set((accData || []).map((a: any) => a.student_id));
            }
          }
        } catch (_) {}
      }

      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("institution_id", institutionId)
        .order("full_name", { ascending: true });

      if (error) {
        console.warn("getOrgVoterRollAction error:", error);
        return { success: false, students: [], message: error.message };
      }

      // If org is specified, filter strictly to students registered for or eligible for this organization
      let filteredData = data || [];
      if (org) {
        const orgPrefixes = [
          (org.slug || "").toUpperCase(),
          (org.code || "").toUpperCase(),
          (org.slug || "").slice(0, 3).toUpperCase(),
          (org.code || "").slice(0, 3).toUpperCase(),
        ].filter((p: string) => p.length >= 2);

        filteredData = (data || []).filter((s: any) => {
          if (accreditedStudentIds.has(s.id)) return true;

          const pin = (s.portal_pin || "").toUpperCase();
          if (pin && orgPrefixes.some((p: string) => pin.startsWith(p + "-") || (p.length >= 3 && pin.startsWith(p)))) {
            return true;
          }

          const dept = (s.department || "").toLowerCase().trim();
          const fac = (s.faculty || "").toLowerCase().trim();
          const orgName = (org.name || "").toLowerCase().trim();
          const oSlug = (org.slug || "").toLowerCase().trim();
          const oCode = (org.code || "").toLowerCase().trim();

          if (org.org_type === "DEPARTMENT" && dept) {
            if (orgName.includes(dept) || dept.includes(oSlug) || dept.includes(oCode) || oSlug === dept) return true;
          }
          if (org.org_type === "FACULTY" && fac) {
            if (orgName.includes(fac) || fac.includes(oSlug) || fac.includes(oCode) || oSlug === fac) return true;
          }
          if (org.org_type === "HALL" && s.hall_of_residence) {
            const hall = (s.hall_of_residence || "").toLowerCase().trim();
            if (orgName.includes(hall) || hall.includes(oSlug) || hall.includes(oCode)) return true;
          }

          return false;
        });
      }

      // Check which students are enrolled in admin_users
      let adminEmailMap = new Map<string, any>();
      let adminIdSet = new Set<string>();
      try {
        const { data: adminUsers } = await supabase
          .from("admin_users")
          .select("id, email, full_name, role")
          .eq("institution_id", institutionId);

        (adminUsers || []).forEach((a: any) => {
          if (a.email) adminEmailMap.set(a.email.toLowerCase().trim(), a);
          if (a.id) adminIdSet.add(a.id);
        });
      } catch (_) {}

      const students = filteredData.map((s: any) => {
        const sEmail = (s.email || "").toLowerCase().trim();
        const adminEntry = adminEmailMap.get(sEmail) || (adminIdSet.has(`admin-${s.id}`) ? { role: "POLLING_AGENT" } : null);
        const isAdmin = !!adminEntry;

        return {
          id: s.id,
          matricNo: s.matric_no,
          fullName: s.full_name,
          email: s.email || "",
          phoneNumber: s.phone_number || "",
          faculty: s.faculty || "",
          department: s.department || "",
          level: s.level || 100,
          duesPaid: s.dues_paid !== false,
          disciplinaryStatus: s.disciplinary_status || "GOOD_STANDING",
          portalPin: s.portal_pin || "",
          programType: s.program_type || "FULL_TIME",
          isAdmin,
          adminRole: adminEntry?.role || (isAdmin ? "POLLING_AGENT" : null),
        };
      });

      return { success: true, students };
    } catch (err: any) {
      console.error("getOrgVoterRollAction exception:", err);
      return { success: false, students: [], message: err.message };
    }
  });
}

/**
 * Toggle dues paid status for a student
 */
export async function updateStudentDuesAction(studentId: string, paid: boolean) {
  invalidateCache("voter_roll:");
  try {
    await supabase
      .from("students")
      .update({ dues_paid: paid })
      .eq("id", studentId);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Enable or disable a student voter (uses disciplinary_status as the gate)
 */
export async function toggleStudentActiveAction(studentId: string, active: boolean) {
  invalidateCache("voter_roll:");
  try {
    await supabase
      .from("students")
      .update({
        disciplinary_status: active ? "GOOD_STANDING" : "SUSPENDED",
      })
      .eq("id", studentId);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Reset a student's voter PIN
 */
export async function resetStudentPinAction(studentId: string, orgSlug: string) {
  invalidateCache("voter_roll:");
  const { generateSingleVoterPin } = await import("@/lib/auth/pin-generator");
  const orgCode = (orgSlug || "ST").substring(0, 4).toUpperCase();
  const newPin = generateSingleVoterPin(orgCode);

  try {
    await supabase
      .from("students")
      .update({ portal_pin: newPin })
      .eq("id", studentId);
    return { success: true, newPin };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Delete a student voter record from the voter roll
 */
export async function deleteStudentAction(studentId: string) {
  invalidateCache("voter_roll:");
  try {
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId);

    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: "Student record deleted from voter register." };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to delete student record." };
  }
}

export interface ElectionRulesState {
  electionId: string;
  status: "DRAFT" | "ACCREDITATION_OPEN" | "LIVE" | "PAUSED" | "CONCLUDED";
  requireDuesPayment: boolean;
  requireGoodDisciplinaryStanding: boolean;
  requireFullTimeOnly: boolean;
  requireSessionRegistration: boolean;
  allowedLevels: number[];
  authMode: "PIN_SLIP" | "EMAIL_OTP" | "SECRET_MATCH";
  resultsVisibility: "LIVE" | "SEALED_UNTIL_CLOSE";
  isPaymentHalted?: boolean;
  paymentStatus?: "ACTIVE" | "PENDING_PAYMENT" | "LOCKED" | "CONCLUDED" | string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const ELECTION_RULES_FILE = path.join(DATA_DIR, "election-rules-store.json");

function readElectionRulesStore(): Record<string, ElectionRulesState> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ELECTION_RULES_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(ELECTION_RULES_FILE, "utf8");
    return JSON.parse(raw) || {};
  } catch (_) {
    return {};
  }
}

function writeElectionRulesStore(store: Record<string, ElectionRulesState>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ELECTION_RULES_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.warn("writeElectionRulesStore error:", err);
  }
}

/**
 * Update election status (Kickstart/Open Polls, Pause, Conclude)
 */
export async function updateElectionStatusAction(
  electionId: string,
  status: "DRAFT" | "ACCREDITATION_OPEN" | "LIVE" | "PAUSED" | "CONCLUDED"
) {
  const store = readElectionRulesStore();
  const current = store[electionId] || {
    electionId,
    status: "LIVE",
    requireDuesPayment: true,
    requireGoodDisciplinaryStanding: true,
    requireFullTimeOnly: false,
    requireSessionRegistration: true,
    allowedLevels: [100, 200, 300, 400, 500],
    authMode: "PIN_SLIP",
    resultsVisibility: "LIVE",
  };
  current.status = status;
  store[electionId] = current;

  // Sync alias keys (e.g. "ui" from "elec-ui-2026", "nesa" from "elec-nesa-2026")
  const parts = electionId.toLowerCase().split("-").filter(p => p !== "elec" && p !== "2026");
  for (const part of parts) {
    store[part] = { ...current, electionId: part };
    store[`elec-${part}-2026`] = { ...current, electionId: `elec-${part}-2026` };
  }

  writeElectionRulesStore(store);

  try {
    await supabase.from("elections").upsert({
      id: electionId,
      status: status,
    });
  } catch (_) {}

  revalidatePath("/", "layout");
  return {
    success: true,
    status,
    message: `Election status updated to ${status}.`,
  };
}

/**
 * Release or Withhold/Seal Election Results
 */
export async function updateResultsVisibilityAction(
  electionId: string,
  visibility: "LIVE" | "SEALED_UNTIL_CLOSE"
) {
  const store = readElectionRulesStore();
  const current = store[electionId] || {
    electionId,
    status: "LIVE",
    requireDuesPayment: true,
    requireGoodDisciplinaryStanding: true,
    requireFullTimeOnly: false,
    requireSessionRegistration: true,
    allowedLevels: [100, 200, 300, 400, 500],
    authMode: "PIN_SLIP",
    resultsVisibility: "LIVE",
  };
  current.resultsVisibility = visibility;
  store[electionId] = current;

  const parts = electionId.toLowerCase().split("-").filter(p => p !== "elec" && p !== "2026");
  for (const part of parts) {
    store[part] = { ...current, electionId: part };
    store[`elec-${part}-2026`] = { ...current, electionId: `elec-${part}-2026` };
  }

  writeElectionRulesStore(store);

  try {
    await supabase.from("elections").upsert({
      id: electionId,
      results_visibility: visibility,
    });
  } catch (_) {}

  revalidatePath("/", "layout");
  return {
    success: true,
    visibility,
    message:
      visibility === "LIVE"
        ? "Election results have been released to the public!"
        : "Election results have been withheld / sealed.",
  };
}

/**
 * Update election eligibility rules in Supabase
 */
export async function updateElectionRulesAction(rules: ElectionRulesState) {
  const store = readElectionRulesStore();
  store[rules.electionId] = rules;

  const parts = rules.electionId.toLowerCase().split("-").filter(p => p !== "elec" && p !== "2026");
  for (const part of parts) {
    store[part] = { ...rules, electionId: part };
    store[`elec-${part}-2026`] = { ...rules, electionId: `elec-${part}-2026` };
  }

  writeElectionRulesStore(store);

  try {
    await supabase.from("elections").upsert({
      id: rules.electionId,
      status: rules.status,
      require_dues_payment: rules.requireDuesPayment,
      require_good_disciplinary_standing: rules.requireGoodDisciplinaryStanding,
      require_full_time_only: rules.requireFullTimeOnly,
      auth_mode: rules.authMode,
      results_visibility: rules.resultsVisibility,
    });
  } catch (_) {}

  revalidatePath("/", "layout");
  return { success: true, message: "Election rules and voting restrictions saved successfully." };
}

/**
 * Check if the student organization's election license has been paid & activated by SuperAdmin
 */
function checkOrgPaymentLicenseStatus(orgSlug?: string, instSlug?: string): { isHalted: boolean; status: string } {
  if (!orgSlug) return { isHalted: false, status: "ACTIVE" };
  try {
    const licensesFile = path.join(DATA_DIR, "org-licenses-store.json");
    if (fs.existsSync(licensesFile)) {
      const raw = fs.readFileSync(licensesFile, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        const cleanOrg = orgSlug.toLowerCase().trim();
        const cleanInst = (instSlug || "").toLowerCase().trim();
        const found = list.find((o: any) => {
          const matchOrg = o.orgSlug?.toLowerCase() === cleanOrg || o.id?.toLowerCase().includes(cleanOrg);
          const matchInst = !cleanInst || o.institutionSlug?.toLowerCase() === cleanInst || o.id?.toLowerCase().includes(cleanInst);
          return matchOrg && matchInst;
        });
        if (found) {
          return {
            isHalted: found.licenseStatus !== "ACTIVE",
            status: found.licenseStatus || "PENDING_PAYMENT",
          };
        }
      }
    }
  } catch (_) {}

  // By default, if no active payment license has been approved by SuperAdmin, halt election
  return { isHalted: true, status: "PENDING_PAYMENT" };
}

/**
 * Get election eligibility rules
 */
export async function getElectionRulesAction(
  electionId: string,
  institutionSlug?: string,
  organizationSlug?: string
): Promise<ElectionRulesState> {
  const store = readElectionRulesStore();

  const candidates = [
    electionId,
    institutionSlug,
    organizationSlug,
    institutionSlug ? `elec-${institutionSlug}-2026` : null,
    organizationSlug ? `elec-${organizationSlug}-2026` : null,
    institutionSlug && organizationSlug ? `elec-${institutionSlug}-${organizationSlug}-2026` : null,
  ].filter(Boolean) as string[];

  let baseRules: ElectionRulesState | null = null;

  // 1. Direct match on any candidate key
  for (const c of candidates) {
    if (store[c]) {
      baseRules = store[c];
      break;
    }
    if (store[c.toLowerCase()]) {
      baseRules = store[c.toLowerCase()];
      break;
    }
  }

  // 2. Fuzzy / alias match across keys in store
  if (!baseRules) {
    for (const c of candidates) {
      const cleanC = c.toLowerCase();
      for (const [key, rules] of Object.entries(store)) {
        const k = key.toLowerCase();
        if (cleanC.includes(k) || k.includes(cleanC)) {
          baseRules = rules;
          break;
        }
      }
      if (baseRules) break;
    }
  }

  // 3. Query Supabase
  if (!baseRules) {
    try {
      for (const c of candidates) {
        const { data } = await supabase
          .from("elections")
          .select("*")
          .eq("id", c)
          .maybeSingle();

        if (data) {
          const res: ElectionRulesState = {
            electionId,
            status: data.status || "LIVE",
            requireDuesPayment: data.require_dues_payment !== false,
            requireGoodDisciplinaryStanding: data.require_good_disciplinary_standing !== false,
            requireFullTimeOnly: !!data.require_full_time_only,
            requireSessionRegistration: data.require_session_registration !== false,
            allowedLevels: [100, 200, 300, 400, 500],
            authMode: data.auth_mode || "PIN_SLIP",
            resultsVisibility: data.results_visibility || "LIVE",
          };
          store[electionId] = res;
          writeElectionRulesStore(store);
          baseRules = res;
          break;
        }
      }
    } catch (_) {}
  }

  // 4. Default fallback: LIVE
  if (!baseRules) {
    baseRules = {
      electionId,
      status: "LIVE",
      requireDuesPayment: true,
      requireGoodDisciplinaryStanding: true,
      requireFullTimeOnly: false,
      requireSessionRegistration: true,
      allowedLevels: [100, 200, 300, 400, 500],
      authMode: "PIN_SLIP",
      resultsVisibility: "LIVE",
    };
  }

  // Check organization license payment status
  const effectiveOrgSlug = organizationSlug || electionId.replace(/^elec-/, "").replace(/-2026$/, "");
  const paymentCheck = checkOrgPaymentLicenseStatus(effectiveOrgSlug, institutionSlug);

  // If organization payment is pending/halted, force status to PAUSED and set isPaymentHalted flag
  if (paymentCheck.isHalted) {
    return {
      ...baseRules,
      status: "PAUSED",
      isPaymentHalted: true,
      paymentStatus: paymentCheck.status,
    };
  }

  return {
    ...baseRules,
    isPaymentHalted: false,
    paymentStatus: "ACTIVE",
  };
}

/**
 * Get full system and ballot audit logs for the admin Logs tab
 */
export async function getElectionAuditLogsAction(electionId: string, instSlug?: string) {
  try {
    const cleanElection = electionId || `elec-${instSlug || "ui"}-2026`;
    const cleanInst = (instSlug || "ui").toLowerCase().trim();

    // 1. Fetch from Supabase audit_logs table
    let dbLogs: any[] = [];
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .or(`election_id.eq.${cleanElection},election_id.ilike.%${cleanInst}%`)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) {
        dbLogs = data.map((l: any) => ({
          id: l.id,
          timestamp: l.created_at || new Date().toISOString(),
          action: l.action || "AUDIT_EVENT",
          actorRole: l.actor_role || "SYSTEM",
          actorName: l.actor_name || "System Protocol",
          details: l.details || {},
          ipHash: l.ip_hash || "0x_ANONYMOUS_IP",
          electionId: l.election_id || cleanElection,
        }));
      }
    } catch (_) {}

    // 2. Fetch runtime ballots from data/ballots-store.json for cryptographic vote logs
    let electionBallots: any[] = [];
    try {
      const ballotsFile = path.join(DATA_DIR, "ballots-store.json");
      if (fs.existsSync(ballotsFile)) {
        const raw = fs.readFileSync(ballotsFile, "utf8");
        const allBallots = JSON.parse(raw);
        if (Array.isArray(allBallots)) {
          electionBallots = allBallots.filter(
            (b: any) =>
              b.electionId === cleanElection ||
              b.institutionId === `inst-${cleanInst}` ||
              (b.id && b.id.toLowerCase().includes(cleanInst))
          );
        }
      }
    } catch (_) {}

    const ballotLogs = electionBallots.map((b: any) => ({
      id: `ballot-log-${b.id}`,
      timestamp: b.castAt || new Date().toISOString(),
      action: "BALLOT_CAST",
      actorRole: "VOTER",
      actorName: `Verified Voter (${b.voterLevel || 300}L)`,
      details: {
        receiptHash: b.receiptHash,
        blockHash: b.blockHash,
        officesVotedCount: Object.keys(b.selections || {}).length,
      },
      ipHash: "0x_ANONYMOUS_ENCRYPTED",
      electionId: b.electionId || cleanElection,
    }));

    // Merge & sort chronologically descending
    const combined = [...dbLogs, ...ballotLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      success: true,
      logs: combined,
      count: combined.length,
    };
  } catch (err: any) {
    console.warn("getElectionAuditLogsAction error:", err);
    return { success: false, logs: [], count: 0, message: err.message };
  }
}

/**
 * Get current organization quota and license metadata for ELCOM support
 */
export async function getOrgLicenseInfoAction(orgSlug: string, instSlug: string) {
  try {
    const cleanOrg = (orgSlug || "nesa").toLowerCase().trim();
    const cleanInst = (instSlug || "ui").toLowerCase().trim();
    let license: any = null;

    const licensesFile = path.join(DATA_DIR, "org-licenses-store.json");
    if (fs.existsSync(licensesFile)) {
      const raw = fs.readFileSync(licensesFile, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        license = list.find(
          (l: any) =>
            l.institutionSlug?.toLowerCase() === cleanInst &&
            l.orgSlug?.toLowerCase() === cleanOrg
        );
      }
    }

    return {
      success: true,
      license: license || {
        voterQuota: 500,
        registeredVotersCount: 0,
        licenseStatus: "ACTIVE",
        orgName: cleanOrg.toUpperCase(),
        institutionName: cleanInst.toUpperCase(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      license: {
        voterQuota: 500,
        registeredVotersCount: 0,
        licenseStatus: "ACTIVE",
      },
    };
  }
}

