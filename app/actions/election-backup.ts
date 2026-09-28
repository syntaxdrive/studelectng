"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { supabase, invalidateCache } from "@/lib/supabase";

const DATA_DIR = path.join(process.cwd(), "data");

const STORE_FILES = {
  candidates: path.join(DATA_DIR, "candidates-store.json"),
  ballots: path.join(DATA_DIR, "ballots-store.json"),
  votedStudents: path.join(DATA_DIR, "voted-students-store.json"),
  electionRules: path.join(DATA_DIR, "election-rules-store.json"),
  orgLicenses: path.join(DATA_DIR, "org-licenses-store.json"),
  commissionerAssignments: path.join(DATA_DIR, "commissioner-assignments.json"),
  whitelistsDir: path.join(DATA_DIR, "electorate-whitelists"),
};

function safeReadJson(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * EXPORT: Reads all election data stores for a specific election/org and returns
 * a comprehensive JSON backup bundle including registration data and audit trails.
 */
export async function exportElectionBackupAction(
  electionId: string,
  orgSlug: string,
  instSlug: string
): Promise<{
  success: boolean;
  bundle?: any;
  message?: string;
}> {
  try {
    const cleanInst = (instSlug || "ui").toLowerCase().trim();
    const cleanOrg = (orgSlug || "nesa").toLowerCase().trim();

    const candidatesStore = safeReadJson(STORE_FILES.candidates);
    const allBallots = safeReadJson(STORE_FILES.ballots) || [];
    const allVotedStudents = safeReadJson(STORE_FILES.votedStudents) || [];
    const electionRules = safeReadJson(STORE_FILES.electionRules) || {};
    const orgLicenses = safeReadJson(STORE_FILES.orgLicenses) || [];
    const commissionerAssignments = safeReadJson(STORE_FILES.commissionerAssignments) || {};

    // 1. Filter ballots and voted deduplication records for this election
    const electionBallots = allBallots.filter((b: any) => b.electionId === electionId);
    const electionVotedStudents = allVotedStudents.filter((v: any) => v.electionId === electionId);
    const thisElectionRules = electionRules[electionId] || null;

    // 2. Filter candidates: posts belonging to this election
    const allPosts = candidatesStore?.posts || [];
    const electionPosts = allPosts.filter((p: any) => p.electionId === electionId);

    // 3. Org license for this org
    const orgId = `org-${cleanInst}-${cleanOrg}`;
    const orgLicense = orgLicenses.find((l: any) => l.id === orgId) || null;

    // 4. Commissioner assignments for this org
    const orgCommissioners = Object.entries(commissionerAssignments)
      .filter(([, v]: [string, any]) => v.orgSlug === cleanOrg && v.institutionSlug === cleanInst)
      .reduce((acc: any, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});

    // 5. Registered Voters / Registration Roll (all students registered for this election)
    let registeredStudents: any[] = [];
    try {
      const { getOrgVoterRollAction } = await import("./student-register");
      const rollRes = await getOrgVoterRollAction(cleanInst, cleanOrg);
      if (rollRes?.success && Array.isArray(rollRes.students)) {
        registeredStudents = rollRes.students;
      }
    } catch (err) {
      console.warn("export: failed to fetch voter roll:", err);
    }

    // 6. Electorate Whitelist (pre-uploaded eligible roster)
    let whitelist: any[] = [];
    try {
      const whitelistFile = path.join(STORE_FILES.whitelistsDir, `${cleanInst}-${cleanOrg}.json`);
      whitelist = safeReadJson(whitelistFile) || [];
    } catch (_) {}

    // 7. Audit Ledger Logs
    let auditLogs: any[] = [];
    try {
      const { getElectionAuditLogsAction } = await import("./student-register");
      const auditRes = await getElectionAuditLogsAction(electionId, cleanInst);
      if (auditRes?.success && Array.isArray(auditRes.logs)) {
        auditLogs = auditRes.logs;
      }
    } catch (_) {}

    const bundle = {
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: "StudElect Comprehensive Backup System",
        version: "2.0",
        electionId,
        orgSlug: cleanOrg,
        instSlug: cleanInst,
        orgId,
        counts: {
          registeredStudents: registeredStudents.length,
          whitelist: whitelist.length,
          posts: electionPosts.length,
          candidates: electionPosts.reduce((a: number, p: any) => a + (p.candidates?.length || 0), 0),
          ballots: electionBallots.length,
          auditLogs: auditLogs.length,
        },
      },
      electionRules: thisElectionRules,
      posts: electionPosts,
      ballots: electionBallots,
      votedStudents: electionVotedStudents,
      registeredStudents,
      whitelist,
      auditLogs,
      orgLicense,
      commissionerAssignments: orgCommissioners,
    };

    return { success: true, bundle };
  } catch (err: any) {
    console.error("exportElectionBackupAction error:", err);
    return { success: false, message: err.message || "Export failed" };
  }
}

/**
 * IMPORT/RESTORE: Takes a backup bundle JSON and restores ALL data:
 * - Registered student accounts (upserted to database with PINs & credentials)
 * - Electorate whitelist
 * - Contested offices & candidates
 * - Verified cast ballots & deduplication ledger
 * - Election configuration & rules
 * - Organization licenses & commissioner assignments
 */
export async function importElectionBackupAction(
  bundleJson: string
): Promise<{ success: boolean; message: string; summary?: any }> {
  try {
    let bundle: any;
    try {
      bundle = JSON.parse(bundleJson);
    } catch {
      return { success: false, message: "Invalid JSON — the backup file could not be parsed." };
    }

    const meta = bundle._meta;
    if (!meta?.electionId || !meta?.orgSlug || !meta?.instSlug) {
      return {
        success: false,
        message: "Invalid backup file — missing _meta fields (electionId, orgSlug, instSlug).",
      };
    }

    const { electionId, orgSlug, instSlug } = meta;
    const cleanInst = instSlug.toLowerCase().trim();
    const cleanOrg = orgSlug.toLowerCase().trim();

    // Ensure data directories exist
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_FILES.whitelistsDir)) {
      fs.mkdirSync(STORE_FILES.whitelistsDir, { recursive: true });
    }

    // 1. Restore registered students / voter accounts
    let studentsRestoredCount = 0;
    if (bundle.registeredStudents && Array.isArray(bundle.registeredStudents) && bundle.registeredStudents.length > 0) {
      try {
        const studentRows = bundle.registeredStudents.map((s: any) => ({
          id: s.id || `stud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          institution_id: `inst-${cleanInst}`,
          matric_no: s.matricNo || s.matric_no,
          normalized_matric: (s.matricNo || s.matric_no || "").toLowerCase().replace(/[^a-z0-9]/g, ""),
          full_name: s.fullName || s.full_name || "Student Voter",
          department: s.department || "General Studies",
          level: Number(s.level) || 100,
          faculty: s.faculty || "",
          program_type: s.programType || s.program_type || "FULL_TIME",
          dues_paid: s.duesPaid !== undefined ? s.duesPaid : true,
          disciplinary_status: s.disciplinaryStatus || s.disciplinary_status || "GOOD_STANDING",
          portal_pin: s.portalPin || s.portal_pin || "",
          email: s.email || null,
          phone_number: s.phoneNumber || s.phone_number || null,
        }));

        const { error: upsertError } = await supabase
          .from("students")
          .upsert(studentRows);

        if (!upsertError) {
          studentsRestoredCount = studentRows.length;
        } else {
          console.warn("restore students error:", upsertError);
        }
      } catch (err) {
        console.warn("restore students exception:", err);
      }
    }

    // 2. Restore Electorate Whitelist file
    let whitelistRestoredCount = 0;
    if (bundle.whitelist && Array.isArray(bundle.whitelist)) {
      try {
        const whitelistFile = path.join(STORE_FILES.whitelistsDir, `${cleanInst}-${cleanOrg}.json`);
        fs.writeFileSync(whitelistFile, JSON.stringify(bundle.whitelist, null, 2), "utf8");
        whitelistRestoredCount = bundle.whitelist.length;
      } catch (err) {
        console.warn("restore whitelist error:", err);
      }
    }

    // 3. Restore election rules (merge, preserve other elections)
    if (bundle.electionRules) {
      const existing = safeReadJson(STORE_FILES.electionRules) || {};
      existing[electionId] = bundle.electionRules;
      fs.writeFileSync(STORE_FILES.electionRules, JSON.stringify(existing, null, 2), "utf8");
    }

    // 4. Restore candidates/posts (replace posts for this election, keep others)
    let candidatesCount = 0;
    if (bundle.posts) {
      const existing = safeReadJson(STORE_FILES.candidates) || { posts: [] };
      const otherPosts = (existing.posts || []).filter((p: any) => p.electionId !== electionId);
      existing.posts = [...otherPosts, ...bundle.posts];
      fs.writeFileSync(STORE_FILES.candidates, JSON.stringify(existing, null, 2), "utf8");
      candidatesCount = (bundle.posts || []).reduce((a: number, p: any) => a + (p.candidates?.length || 0), 0);
    }

    // 5. Restore ballots (merge, deduplicate by ballot id)
    let ballotsCount = 0;
    if (bundle.ballots && Array.isArray(bundle.ballots)) {
      const existing = safeReadJson(STORE_FILES.ballots) || [];
      const otherBallots = existing.filter((b: any) => b.electionId !== electionId);
      const merged = [...otherBallots, ...bundle.ballots];
      fs.writeFileSync(STORE_FILES.ballots, JSON.stringify(merged, null, 2), "utf8");
      ballotsCount = bundle.ballots.length;
    }

    // 6. Restore voted-students (deduplication store)
    let votedStudentsCount = 0;
    if (bundle.votedStudents && Array.isArray(bundle.votedStudents)) {
      const existing = safeReadJson(STORE_FILES.votedStudents) || [];
      const otherVoted = existing.filter((v: any) => v.electionId !== electionId);
      const merged = [...otherVoted, ...bundle.votedStudents];
      fs.writeFileSync(STORE_FILES.votedStudents, JSON.stringify(merged, null, 2), "utf8");
      votedStudentsCount = bundle.votedStudents.length;
    }

    // 7. Restore org license (upsert)
    if (bundle.orgLicense) {
      const existing = safeReadJson(STORE_FILES.orgLicenses) || [];
      const orgId = `org-${cleanInst}-${cleanOrg}`;
      const idx = existing.findIndex((l: any) => l.id === orgId);
      if (idx >= 0) {
        existing[idx] = bundle.orgLicense;
      } else {
        existing.push(bundle.orgLicense);
      }
      fs.writeFileSync(STORE_FILES.orgLicenses, JSON.stringify(existing, null, 2), "utf8");
    }

    // 8. Restore commissioner assignments (merge)
    if (bundle.commissionerAssignments && Object.keys(bundle.commissionerAssignments).length > 0) {
      const existing = safeReadJson(STORE_FILES.commissionerAssignments) || {};
      Object.assign(existing, bundle.commissionerAssignments);
      fs.writeFileSync(STORE_FILES.commissionerAssignments, JSON.stringify(existing, null, 2), "utf8");
    }

    invalidateCache();
    revalidatePath("/[institution]/admin");
    revalidatePath("/[institution]/[organization]");

    const summary = {
      registeredStudentsRestored: studentsRestoredCount,
      whitelistEntriesRestored: whitelistRestoredCount,
      postsRestored: bundle.posts?.length || 0,
      candidatesRestored: candidatesCount,
      ballotsRestored: ballotsCount,
      votedStudentsRestored: votedStudentsCount,
    };

    return {
      success: true,
      message: `Complete election data restored for ${cleanOrg.toUpperCase()}! (${studentsRestoredCount} voter profiles, ${whitelistRestoredCount} whitelist records, ${candidatesCount} candidates, ${ballotsCount} cast ballots).`,
      summary,
    };
  } catch (err: any) {
    console.error("importElectionBackupAction error:", err);
    return { success: false, message: err.message || "Restore failed" };
  }
}
