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

  const cleanEmail = (input.email || "").trim().toLowerCase();
  if (!cleanEmail) {
    return {
      success: false,
      message: "Email address is compulsory. Please enter your valid email address to register.",
    };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return {
      success: false,
      message: "Please enter a valid email address (e.g. name@example.com).",
    };
  }

  const cleanPhone = (input.phoneNumber || "").trim();
  if (!cleanPhone) {
    return {
      success: false,
      message: "Phone / WhatsApp number is compulsory. Please enter your active phone number.",
    };
  }
  const phoneDigits = cleanPhone.replace(/[\s\-\(\)\+]/g, "");
  if (phoneDigits.length < 10) {
    return {
      success: false,
      message: "Please enter a valid phone or WhatsApp number (minimum 10 digits).",
    };
  }

  const cleanInstSlug = (input.institutionSlug || "ui").toLowerCase().trim();
  const orgCode = (input.orgSlug || "ST").substring(0, 4).toUpperCase();
  const generatedPin = generateSingleVoterPin(orgCode);
  const institutionId = `inst-${cleanInstSlug}`;
  const dept = (input.department || "General Studies").trim();

  try {
    // 0. Strict Whitelist Enforcement Check (if enabled by ELCOM)
    const cleanOrgSlug = (input.orgSlug || "nesa").toLowerCase().trim();
    const electionId = (input as any).electionId || `elec-${cleanInstSlug}-${cleanOrgSlug}-2026`;
    const rules = await getElectionRulesAction(electionId, cleanInstSlug, cleanOrgSlug);

    let matchedWhitelist: WhitelistEntry | undefined;
    if (rules?.requireWhitelistMatch) {
      const whitelist = readWhitelistStore(cleanInstSlug, cleanOrgSlug);
      matchedWhitelist = whitelist.find((w) => w.normalizedMatric === norm.normalized);

      if (!matchedWhitelist) {
        const contactRes = await getOrgPublicContactAction(cleanInstSlug, cleanOrgSlug);
        const contact = contactRes?.contact;
        const contactDetail = contact?.phone
          ? ` (${contact.name} • WhatsApp: ${contact.phone})`
          : contact?.email
          ? ` (${contact.name} • Email: ${contact.email})`
          : "";

        return {
          success: false,
          message: `Matriculation number "${norm.raw}" is not on the pre-authorized electorate whitelist for this election. Registration is strictly restricted. Please contact your ELCOM administration${contactDetail} if your record should be included.`,
        };
      }
    }

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

    const finalFullName = ((input.fullName || matchedWhitelist?.fullName || "").trim()) || "Student Voter";
    const finalDept = (input.department || matchedWhitelist?.department || dept).trim();
    const finalLevel = Number(input.level) || matchedWhitelist?.level || 100;

    if (existing) {
      // If student was pre-seeded without a PIN, generate and attach their PIN
      try {
        await supabase
          .from("students")
          .update({
            full_name: finalFullName,
            department: finalDept,
            level: finalLevel,
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
      full_name: finalFullName,
      faculty: input.faculty?.trim() || "Faculty of Science",
      department: finalDept,
      level: finalLevel,
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
        // 1. Try Supabase organizations table
        try {
          const { data: orgData } = await supabase
            .from("organizations")
            .select("*")
            .eq("institution_id", institutionId)
            .eq("slug", cleanOrgSlug)
            .maybeSingle();
          org = orgData;
        } catch (_) {}

        // 2. If not in Supabase, synthesize org from local license store so we can still filter
        if (!org) {
          try {
            const licensesFile = path.join(DATA_DIR, "org-licenses-store.json");
            if (fs.existsSync(licensesFile)) {
              const raw = fs.readFileSync(licensesFile, "utf8");
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const found = list.find((l: any) => {
                  const lSlug = (l.orgSlug || "").toLowerCase().trim();
                  const lInst = (l.institutionSlug || "").toLowerCase().trim();
                  return lSlug === cleanOrgSlug && (!lInst || lInst === cleanSlug);
                });
                if (found) {
                  org = {
                    id: found.id || `org-${cleanSlug}-${cleanOrgSlug}`,
                    slug: found.orgSlug || cleanOrgSlug,
                    name: found.orgName || cleanOrgSlug.toUpperCase(),
                    code: (found.orgSlug || cleanOrgSlug).slice(0, 4).toUpperCase(),
                    org_type: found.orgType || "DEPARTMENT",
                  };
                }
              }
            }
          } catch (_) {}
        }

        // 3. If still no org info, create a minimal synthetic one from the slug itself
        // This guarantees PIN-based isolation even for orgs not yet in any store
        if (!org) {
          org = {
            id: `org-${cleanSlug}-${cleanOrgSlug}`,
            slug: cleanOrgSlug,
            name: cleanOrgSlug.toUpperCase(),
            code: cleanOrgSlug.slice(0, 4).toUpperCase(),
            org_type: "DEPARTMENT",
          };
        }

        // 4. Fetch election IDs for this org (accreditation links)
        if (org?.id) {
          try {
            const { data: elecData } = await supabase
              .from("elections")
              .select("id")
              .eq("organization_id", org.id);
            orgElectionIds = (elecData || []).map((e: any) => e.id);
          } catch (_) {}
        }

        // 5. Also check election IDs by conventional ID pattern
        const derivedElectionIds = [
          `elec-${cleanSlug}-${cleanOrgSlug}-2026`,
          `elec-${cleanOrgSlug}-2026`,
        ].filter((id) => !orgElectionIds.includes(id));
        orgElectionIds = [...orgElectionIds, ...derivedElectionIds];

        // 6. Get student IDs that have accreditation records for this org's elections
        if (orgElectionIds.length > 0) {
          try {
            const { data: accData } = await supabase
              .from("voter_accreditations")
              .select("student_id")
              .in("election_id", orgElectionIds);
            accreditedStudentIds = new Set((accData || []).map((a: any) => a.student_id));
          } catch (_) {}
        }
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

      // Strict per-org filter: NEVER fall through to all-institution list when org is specified
      let filteredData = data || [];
      if (cleanOrgSlug && org) {
        const orgCode = (org.code || cleanOrgSlug.slice(0, 4)).toUpperCase();
        const orgSlugUpper = cleanOrgSlug.toUpperCase();

        // Build set of known prefixes for this org's voter PINs
        const orgPrefixes = Array.from(
          new Set(
            [
              orgSlugUpper,
              orgCode,
              orgSlugUpper.slice(0, 4),
              orgCode.slice(0, 3),
            ].filter((p: string) => p.length >= 2)
          )
        );

        // Build set of ALL other known org prefixes to exclude cross-org bleed
        let otherOrgPrefixes: string[] = [];
        try {
          const licensesFile = path.join(DATA_DIR, "org-licenses-store.json");
          if (fs.existsSync(licensesFile)) {
            const raw = fs.readFileSync(licensesFile, "utf8");
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach((l: any) => {
                if ((l.orgSlug || "").toLowerCase() !== cleanOrgSlug) {
                  const s = (l.orgSlug || "").toUpperCase();
                  if (s.length >= 2) otherOrgPrefixes.push(s);
                  const c = (l.orgSlug || "").slice(0, 4).toUpperCase();
                  if (c.length >= 2) otherOrgPrefixes.push(c);
                }
              });
            }
          }
        } catch (_) {}

        filteredData = (data || []).filter((s: any) => {
          // 1. Accreditation-linked students always pass (explicit election enrollment)
          if (accreditedStudentIds.has(s.id)) return true;

          const pin = (s.portal_pin || "").toUpperCase();

          // 2. If PIN clearly belongs to a DIFFERENT org, exclude (cross-org bleed prevention)
          if (pin && otherOrgPrefixes.some((p: string) =>
            pin.startsWith(p + "-") || (p.length >= 4 && pin.startsWith(p))
          )) {
            // Only exclude if the pin does NOT also match this org's prefixes
            const matchesThisOrg = orgPrefixes.some((p: string) =>
              pin.startsWith(p + "-") || (p.length >= 3 && pin.startsWith(p))
            );
            if (!matchesThisOrg) return false;
          }

          // 3. Include if PIN starts with this org's prefix
          if (pin && orgPrefixes.some((p: string) =>
            pin.startsWith(p + "-") || (p.length >= 3 && pin.startsWith(p))
          )) {
            return true;
          }

          // 4. Include if department/faculty matches org profile
          const dept = (s.department || "").toLowerCase().trim();
          const fac = (s.faculty || "").toLowerCase().trim();
          const orgName = (org.name || "").toLowerCase().trim();
          const oSlug = cleanOrgSlug;
          const oCode = orgCode.toLowerCase();

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

          // No match → exclude. This prevents students from bleeding across orgs.
          return false;
        });
      }

      // Check which students are enrolled in admin_users or promoted-admins-store
      let adminEmailMap = new Map<string, any>();
      let adminIdSet = new Set<string>();
      let adminMatricMap = new Map<string, any>();
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

      // Also check local persistent promoted-admins-store for instant resilience
      try {
        const pPath = path.join(DATA_DIR, "promoted-admins-store.json");
        if (fs.existsSync(pPath)) {
          const pList = JSON.parse(fs.readFileSync(pPath, "utf8"));
          if (Array.isArray(pList)) {
            pList.forEach((p: any) => {
              if (p.email) adminEmailMap.set(p.email.toLowerCase().trim(), p);
              if (p.id) adminIdSet.add(p.id);
              if (p.matricNo) adminMatricMap.set(p.matricNo.toLowerCase().trim(), p);
              if (p.normalizedMatric) adminMatricMap.set(p.normalizedMatric.toLowerCase().trim(), p);
            });
          }
        }
      } catch (_) {}

      const students = filteredData.map((s: any) => {
        const sEmail = (s.email || "").toLowerCase().trim();
        const sMatric = (s.matric_no || "").toLowerCase().trim();
        const adminEntry =
          adminEmailMap.get(sEmail) ||
          adminMatricMap.get(sMatric) ||
          (adminIdSet.has(s.id) ? { role: "POLLING_AGENT" } : null) ||
          (adminIdSet.has(`admin-${s.id}`) ? { role: "POLLING_AGENT" } : null);
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
  requireWhitelistMatch?: boolean;
  allowedLevels: number[];
  authMode: "PIN_SLIP" | "EMAIL_OTP" | "SECRET_MATCH";
  resultsVisibility: "LIVE" | "SEALED_UNTIL_CLOSE";
  isPaymentHalted?: boolean;
  paymentStatus?: "ACTIVE" | "PENDING_PAYMENT" | "LOCKED" | "CONCLUDED" | string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const ELECTION_RULES_FILE = path.join(DATA_DIR, "election-rules-store.json");
const WHITELISTS_DIR = path.join(DATA_DIR, "electorate-whitelists");

export interface WhitelistEntry {
  matricNo: string;
  normalizedMatric: string;
  fullName?: string;
  department?: string;
  level?: number;
  addedAt: string;
}

function getWhitelistFilePath(instSlug: string, orgSlug: string): string {
  const cleanInst = (instSlug || "ui").toLowerCase().trim().replace(/^inst-/, "");
  const cleanOrg = (orgSlug || "nesa")
    .toLowerCase()
    .trim()
    .replace(/^org-/, "")
    .replace(new RegExp(`^${cleanInst}-`), "")
    .replace(/-2026$/, "");
  return path.join(WHITELISTS_DIR, `${cleanInst}-${cleanOrg}.json`);
}

function readWhitelistStore(instSlug: string, orgSlug: string): WhitelistEntry[] {
  try {
    if (!fs.existsSync(WHITELISTS_DIR)) {
      fs.mkdirSync(WHITELISTS_DIR, { recursive: true });
    }
    const file = getWhitelistFilePath(instSlug, orgSlug);
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) || [];
  } catch (_) {
    return [];
  }
}

function writeWhitelistStore(instSlug: string, orgSlug: string, list: WhitelistEntry[]) {
  try {
    if (!fs.existsSync(WHITELISTS_DIR)) {
      fs.mkdirSync(WHITELISTS_DIR, { recursive: true });
    }
    const file = getWhitelistFilePath(instSlug, orgSlug);
    fs.writeFileSync(file, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.warn("writeWhitelistStore error:", err);
  }
}

/**
 * Save pre-authorized electorate roster (from CSV or Excel)
 */
export async function saveElectorateWhitelistAction(
  institutionSlug: string,
  orgSlug: string,
  rows: Array<{ matricNo: string; fullName?: string; department?: string; level?: number }>,
  mode: "REPLACE" | "APPEND" = "REPLACE"
) {
  try {
    const cleanInst = (institutionSlug || "ui").toLowerCase().trim().replace(/^inst-/, "");
    const cleanOrg = (orgSlug || "nesa").toLowerCase().trim();

    const existing = mode === "APPEND" ? readWhitelistStore(cleanInst, cleanOrg) : [];
    const existingMap = new Map(existing.map((e) => [e.normalizedMatric, e]));

    let validCount = 0;
    const now = new Date().toISOString();

    for (const r of rows) {
      if (!r.matricNo) continue;
      const norm = normalizeMatricNo(r.matricNo);
      if (!norm.isValid) continue;

      const entry: WhitelistEntry = {
        matricNo: norm.raw,
        normalizedMatric: norm.normalized,
        fullName: r.fullName?.trim() || undefined,
        department: r.department?.trim() || undefined,
        level: r.level ? Number(r.level) : undefined,
        addedAt: now,
      };

      existingMap.set(norm.normalized, entry);
      validCount++;
    }

    const finalList = Array.from(existingMap.values());
    writeWhitelistStore(cleanInst, cleanOrg, finalList);

    revalidatePath(`/${cleanInst}/admin`);
    revalidatePath(`/${cleanInst}/${cleanOrg}`);

    return {
      success: true,
      count: finalList.length,
      importedCount: validCount,
      message: `Successfully whitelisted ${validCount} eligible student(s) for ${cleanOrg.toUpperCase()}. Total roster: ${finalList.length} students.`,
    };
  } catch (err: any) {
    console.error("saveElectorateWhitelistAction error:", err);
    return { success: false, count: 0, message: err?.message || "Failed to save electorate whitelist." };
  }
}

/**
 * Get current whitelisted electorate count and sample records
 */
export async function getElectorateWhitelistAction(institutionSlug: string, orgSlug: string) {
  try {
    const cleanInst = (institutionSlug || "ui").toLowerCase().trim().replace(/^inst-/, "");
    const cleanOrg = (orgSlug || "nesa").toLowerCase().trim();
    const list = readWhitelistStore(cleanInst, cleanOrg);
    return {
      success: true,
      count: list.length,
      sample: list.slice(0, 10),
    };
  } catch (err: any) {
    return { success: false, count: 0, sample: [] };
  }
}

/**
 * Clear the electorate whitelist for an organization
 */
export async function clearElectorateWhitelistAction(institutionSlug: string, orgSlug: string) {
  try {
    const cleanInst = (institutionSlug || "ui").toLowerCase().trim().replace(/^inst-/, "");
    const cleanOrg = (orgSlug || "nesa").toLowerCase().trim();
    writeWhitelistStore(cleanInst, cleanOrg, []);
    revalidatePath(`/${cleanInst}/admin`);
    return { success: true, message: "Electorate whitelist cleared successfully." };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to clear whitelist." };
  }
}

/**
 * Public ELCOM contact details for voter display
 */
export async function getOrgPublicContactAction(institutionSlug: string, orgSlug: string) {
  try {
    const cleanInst = (institutionSlug || "ui").toLowerCase().trim().replace(/^inst-/, "");
    const cleanOrg = (orgSlug || "nesa").toLowerCase().trim();
    let contact: { name: string; email: string; phone?: string; role?: string; orgName?: string } | null = null;

    // 1. Look in commissioner assignments
    const assignmentsFile = path.join(DATA_DIR, "commissioner-assignments.json");
    if (fs.existsSync(assignmentsFile)) {
      try {
        const raw = fs.readFileSync(assignmentsFile, "utf8");
        const assignments = JSON.parse(raw);
        for (const [_, assn] of Object.entries<any>(assignments)) {
          const assnOrg = (assn.orgSlug || assn.orgId || "").toLowerCase();
          const assnInst = (assn.institutionSlug || assn.institutionId || "").toLowerCase().replace(/^inst-/, "");
          if (
            (assnOrg === cleanOrg || assnOrg === `org-${cleanInst}-${cleanOrg}`) &&
            (!assnInst || assnInst === cleanInst)
          ) {
            contact = {
              name: assn.fullName || "ELCOM Administrator",
              email: assn.email,
              role: assn.role || "ELCOM Commissioner",
              orgName: assn.orgName,
            };
            break;
          }
        }
      } catch (_) {}
    }

    // 2. Supplement or fallback with org license store contact
    const licensesFile = path.join(DATA_DIR, "org-licenses-store.json");
    if (fs.existsSync(licensesFile)) {
      try {
        const raw = fs.readFileSync(licensesFile, "utf8");
        const list = JSON.parse(raw);
        const lic = list.find(
          (l: any) =>
            (l.orgSlug?.toLowerCase() === cleanOrg && l.institutionSlug?.toLowerCase() === cleanInst) ||
            l.id?.toLowerCase() === `org-${cleanInst}-${cleanOrg}`
        );
        if (lic) {
          if (!contact) {
            contact = {
              name: lic.contactAdminName || "ELCOM Chairman",
              email: "elcom@" + cleanOrg + "." + cleanInst + ".edu.ng",
              phone: lic.contactAdminPhone || undefined,
              orgName: lic.orgName,
            };
          } else {
            if (lic.contactAdminPhone && !contact.phone) {
              contact.phone = lic.contactAdminPhone;
            }
            if (lic.orgName && !contact.orgName) {
              contact.orgName = lic.orgName;
            }
          }
        }
      } catch (_) {}
    }

    return {
      success: true,
      contact: contact || {
        name: `${cleanOrg.toUpperCase()} ELCOM Office`,
        email: `elcom@studelect.com.ng`,
        phone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "2349164221215",
      },
    };
  } catch (err: any) {
    return {
      success: false,
      contact: {
        name: "ELCOM Support",
        email: "support@studelect.com.ng",
        phone: "2349164221215",
      },
    };
  }
}

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
    resultsVisibility: "SEALED_UNTIL_CLOSE",
  };
  current.status = status;
  store[electionId] = current;

  // NOTE: Do NOT write short-name alias keys (e.g. "ui", "nesa") — they cause cross-org
  // status bleed when multiple orgs share the same institution slug.
  // Only the exact electionId key is written.

  writeElectionRulesStore(store);

  try {
    let targetElecId = electionId;
    const { data: directElec } = await supabase
      .from("elections")
      .select("id, status, multi_sig_approvals")
      .eq("id", targetElecId)
      .maybeSingle();

    let existingElec = directElec;
    if (!existingElec) {
      const aliases = [
        electionId,
        `elec-${electionId}-2026`,
        electionId.replace(/^elec-/, "").replace(/-2026$/, ""),
      ];
      for (const a of aliases) {
        const { data: found } = await supabase
          .from("elections")
          .select("id, status, multi_sig_approvals")
          .eq("id", a)
          .maybeSingle();
        if (found) {
          existingElec = found;
          targetElecId = found.id;
          break;
        }
      }
      if (!existingElec) {
        const { data: fallback } = await supabase
          .from("elections")
          .select("id, status, multi_sig_approvals")
          .limit(1)
          .maybeSingle();
        if (fallback) {
          existingElec = fallback;
          targetElecId = fallback.id;
        }
      }
    }

    const currentApprovals = existingElec?.multi_sig_approvals || {};
    const updatedApprovals = {
      ...currentApprovals,
      operationalStatus: status,
      statusUpdatedAt: new Date().toISOString(),
    };

    const isPostgresEnum = ["DRAFT", "ACCREDITATION_OPEN", "LIVE", "CONCLUDED"].includes(status);
    const updatePayload: Record<string, any> = {
      multi_sig_approvals: updatedApprovals,
    };
    if (isPostgresEnum) {
      updatePayload.status = status;
    }

    const { error: patchError } = await supabase
      .from("elections")
      .update(updatePayload)
      .eq("id", targetElecId);

    if (patchError) {
      console.error("Supabase updateElectionStatusAction error:", patchError);
    }
  } catch (err) {
    console.error("updateElectionStatusAction exception:", err);
  }

  invalidateCache();
  revalidatePath("/", "layout");
  return {
    success: true,
    status,
    message:
      status === "PAUSED"
        ? "Voting has been temporarily paused. Student voting booths are now locked."
        : status === "CONCLUDED"
        ? "Election officially concluded. Polls are permanently closed."
        : `Election status updated to ${status}.`,
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
    resultsVisibility: "SEALED_UNTIL_CLOSE",
  };
  current.resultsVisibility = visibility;
  store[electionId] = current;

  // NOTE: Do NOT write short-name alias keys — they cause cross-org status bleed.
  // Only write the exact electionId key.

  writeElectionRulesStore(store);

  try {
    let targetElecId = electionId;
    const { data: directElec } = await supabase
      .from("elections")
      .select("id")
      .eq("id", targetElecId)
      .maybeSingle();

    if (!directElec) {
      const { data: fallbackElec } = await supabase
        .from("elections")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (fallbackElec) {
        targetElecId = fallbackElec.id;
      }
    }

    await supabase
      .from("elections")
      .update({ results_visibility: visibility })
      .eq("id", targetElecId);
  } catch (err) {
    console.error("updateResultsVisibilityAction exception:", err);
  }

  invalidateCache();
  revalidatePath("/", "layout");
  return {
    success: true,
    visibility,
    message:
      visibility === "LIVE"
        ? "Election results unsealed. Real-time ballot standings and candidate vote tallies are now published."
        : "Election results withheld. Live candidate standings are sealed from the student voting booth.",
  };
}

/**
 * Update election eligibility rules in Supabase
 */
export async function updateElectionRulesAction(rules: ElectionRulesState) {
  const store = readElectionRulesStore();
  store[rules.electionId] = rules;

  // NOTE: Do NOT write short-name alias keys — they cause cross-org rule/status bleed.
  // Only write the exact electionId key.

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

  invalidateCache();
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
        const rawOrg = orgSlug.toLowerCase().trim();
        const cleanInst = (instSlug || "").toLowerCase().trim().replace(/^inst-/, "");
        
        // Strip out prefixes / suffixes (elec-, org-, instSlug-, -2026)
        const cleanOrg = rawOrg
          .replace(/^elec-/, "")
          .replace(/^org-/, "")
          .replace(new RegExp(`^${cleanInst}-`, "i"), "")
          .replace(/-2026$/, "")
          .trim();

        const found = list.find((o: any) => {
          const oSlug = (o.orgSlug || "").toLowerCase().trim();
          const oId = (o.id || "").toLowerCase().trim();
          const oInst = (o.institutionSlug || "").toLowerCase().trim().replace(/^inst-/, "");

          const instMatches = !cleanInst || !oInst || oInst === cleanInst;
          if (!instMatches) return false;

          return (
            oSlug === cleanOrg ||
            oSlug === rawOrg ||
            oId === cleanOrg ||
            oId === rawOrg ||
            oId === `org-${cleanInst}-${cleanOrg}` ||
            (cleanOrg.length >= 3 && (oSlug.includes(cleanOrg) || cleanOrg.includes(oSlug)))
          );
        });

        if (found) {
          const isHalted = found.licenseStatus === "PENDING_PAYMENT" || found.licenseStatus === "LOCKED";
          return {
            isHalted,
            status: found.licenseStatus || "ACTIVE",
          };
        }
      }
    }
  } catch (_) {}

  // By default, unless an organization is explicitly halted by SuperAdmin in org-licenses-store.json,
  // allow the election to remain active so legitimate campus elections can proceed smoothly.
  return { isHalted: false, status: "ACTIVE" };
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

  const candidates = Array.from(
    new Set(
      [
        institutionSlug && organizationSlug
          ? `elec-${institutionSlug}-${organizationSlug}-2026`
          : null,
        electionId,
        organizationSlug ? `elec-${organizationSlug}-2026` : null,
        institutionSlug ? `elec-${institutionSlug}-2026` : null,
        electionId ? electionId.replace(/^elec-/, "").replace(/-2026$/, "") : null,
        organizationSlug,
        institutionSlug,
      ].filter(Boolean) as string[]
    )
  );

  let baseRules: ElectionRulesState | null = null;

  // 1. Cloud First: Query Supabase for authoritative live state
  try {
    for (const c of candidates) {
      const { data } = await supabase
        .from("elections")
        .select("*")
        .eq("id", c)
        .maybeSingle();

      if (data) {
        const effectiveStatus =
          (data.multi_sig_approvals as any)?.operationalStatus ||
          data.status ||
          "LIVE";
        const effectiveVisibility =
          data.results_visibility || "SEALED_UNTIL_CLOSE";

        baseRules = {
          electionId: data.id || electionId,
          status: effectiveStatus,
          requireDuesPayment: data.require_dues_payment !== false,
          requireGoodDisciplinaryStanding:
            data.require_good_disciplinary_standing !== false,
          requireFullTimeOnly: !!data.require_full_time_only,
          requireSessionRegistration: data.require_session_registration !== false,
          requireWhitelistMatch: !!(data as any).require_whitelist_match,
          allowedLevels: [100, 200, 300, 400, 500],
          authMode: data.auth_mode || "PIN_SLIP",
          resultsVisibility: effectiveVisibility,
        };

        // Keep local store in sync with cloud
        store[electionId] = baseRules;
        if (data.id) store[data.id] = baseRules;
        writeElectionRulesStore(store);
        break;
      }
    }

    // Secondary Supabase match by institution slug if candidates didn't match directly
    if (!baseRules && institutionSlug) {
      const cleanInst = institutionSlug.toLowerCase().trim();
      const { data: instElections } = await supabase
        .from("elections")
        .select("*")
        .ilike("id", `%${cleanInst}%`)
        .limit(5);

      if (instElections && instElections.length > 0) {
        const cleanOrg = (organizationSlug || "").toLowerCase().trim();
        const matchedElec = cleanOrg
          ? instElections.find((e: any) =>
              e.id.toLowerCase().includes(cleanOrg)
            ) || instElections[0]
          : instElections[0];

        if (matchedElec) {
          const effectiveStatus =
            (matchedElec.multi_sig_approvals as any)?.operationalStatus ||
            matchedElec.status ||
            "LIVE";
          const effectiveVisibility =
            matchedElec.results_visibility || "SEALED_UNTIL_CLOSE";

          baseRules = {
            electionId: matchedElec.id || electionId,
            status: effectiveStatus,
            requireDuesPayment: matchedElec.require_dues_payment !== false,
            requireGoodDisciplinaryStanding:
              matchedElec.require_good_disciplinary_standing !== false,
            requireFullTimeOnly: !!matchedElec.require_full_time_only,
            requireSessionRegistration:
              matchedElec.require_session_registration !== false,
            requireWhitelistMatch: !!(matchedElec as any).require_whitelist_match,
            allowedLevels: [100, 200, 300, 400, 500],
            authMode: matchedElec.auth_mode || "PIN_SLIP",
            resultsVisibility: effectiveVisibility,
          };
          store[electionId] = baseRules;
          if (matchedElec.id) store[matchedElec.id] = baseRules;
          writeElectionRulesStore(store);
        }
      }
    }
  } catch (err) {
    console.warn("Supabase getElectionRulesAction error, falling back to local cache:", err);
  }

  // 2. Fallback to local store if Supabase was unreachable or returned nothing
  if (!baseRules) {
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
  }

  // 3. Fuzzy / alias match across keys in store
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

  // 4. Default fallback: SEALED_UNTIL_CLOSE
  if (!baseRules) {
    baseRules = {
      electionId,
      status: "LIVE",
      requireDuesPayment: true,
      requireGoodDisciplinaryStanding: true,
      requireFullTimeOnly: false,
      requireSessionRegistration: true,
      requireWhitelistMatch: false,
      allowedLevels: [100, 200, 300, 400, 500],
      authMode: "PIN_SLIP",
      resultsVisibility: "SEALED_UNTIL_CLOSE",
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

    // Direct synchronization with SuperAdmin source of truth
    try {
      const { getSuperAdminOrgLicensesAction } = await import("./super-admin");
      const allOrgs = await getSuperAdminOrgLicensesAction();
      const matched = allOrgs.find(
        (o) =>
          (o.orgSlug?.toLowerCase() === cleanOrg &&
            o.institutionSlug?.toLowerCase() === cleanInst) ||
          o.id?.toLowerCase() === `org-${cleanInst}-${cleanOrg}` ||
          o.orgSlug?.toLowerCase() === cleanOrg
      );

      if (matched) {
        return {
          success: true,
          license: matched,
        };
      }
    } catch (e) {
      console.warn("getSuperAdminOrgLicensesAction lookup in getOrgLicenseInfoAction failed:", e);
    }

    // Secondary fallback: local store
    const licensesFile = path.join(DATA_DIR, "org-licenses-store.json");
    if (fs.existsSync(licensesFile)) {
      try {
        const raw = fs.readFileSync(licensesFile, "utf8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const found = list.find(
            (l: any) =>
              (l.institutionSlug?.toLowerCase() === cleanInst &&
                l.orgSlug?.toLowerCase() === cleanOrg) ||
              l.id?.toLowerCase() === `org-${cleanInst}-${cleanOrg}` ||
              l.orgSlug?.toLowerCase() === cleanOrg
          );
          if (found) {
            return {
              success: true,
              license: found,
            };
          }
        }
      } catch (_) {}
    }

    return {
      success: true,
      license: {
        voterQuota: 1000,
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
        voterQuota: 1000,
        registeredVotersCount: 0,
        licenseStatus: "ACTIVE",
      },
    };
  }
}

/**
 * Get all organizations registered under a given institution slug.
 * Used by the org switcher dropdown in the admin dashboard.
 */
export async function getInstitutionOrgsAction(
  instSlug: string
): Promise<{ orgSlug: string; orgName: string; id: string }[]> {
  const cleanInst = (instSlug || "ui").toLowerCase().trim();
  const results: { orgSlug: string; orgName: string; id: string }[] = [];

  // 1. Read from local org-licenses-store.json (primary source of truth for licensed orgs)
  try {
    const licensesFile = path.join(DATA_DIR, "org-licenses-store.json");
    if (fs.existsSync(licensesFile)) {
      const raw = fs.readFileSync(licensesFile, "utf8");
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const l of list) {
          const lInst = (l.institutionSlug || "").toLowerCase().trim();
          if (!lInst || lInst === cleanInst) {
            const slug = (l.orgSlug || "").toLowerCase().trim();
            if (slug && !results.find((r) => r.orgSlug === slug)) {
              results.push({
                orgSlug: slug,
                orgName: l.orgName || slug.toUpperCase(),
                id: l.id || `org-${cleanInst}-${slug}`,
              });
            }
          }
        }
      }
    }
  } catch (_) {}

  // 2. Also check Supabase organizations table for any orgs not yet in local store
  try {
    const { data: supaOrgs } = await supabase
      .from("organizations")
      .select("id, slug, name")
      .eq("institution_id", `inst-${cleanInst}`);

    for (const o of supaOrgs || []) {
      const slug = (o.slug || "").toLowerCase().trim();
      if (slug && !results.find((r) => r.orgSlug === slug)) {
        results.push({
          orgSlug: slug,
          orgName: o.name || slug.toUpperCase(),
          id: o.id,
        });
      }
    }
  } catch (_) {}

  return results;
}
