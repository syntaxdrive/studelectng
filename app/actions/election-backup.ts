"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

const DATA_DIR = path.join(process.cwd(), "data");

const STORE_FILES = {
  candidates: path.join(DATA_DIR, "candidates-store.json"),
  ballots: path.join(DATA_DIR, "ballots-store.json"),
  votedStudents: path.join(DATA_DIR, "voted-students-store.json"),
  electionRules: path.join(DATA_DIR, "election-rules-store.json"),
  orgLicenses: path.join(DATA_DIR, "org-licenses-store.json"),
  commissionerAssignments: path.join(DATA_DIR, "commissioner-assignments.json"),
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
 * a single JSON backup bundle.
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
    const candidatesStore = safeReadJson(STORE_FILES.candidates);
    const allBallots = safeReadJson(STORE_FILES.ballots) || [];
    const allVotedStudents = safeReadJson(STORE_FILES.votedStudents) || [];
    const electionRules = safeReadJson(STORE_FILES.electionRules) || {};
    const orgLicenses = safeReadJson(STORE_FILES.orgLicenses) || [];
    const commissionerAssignments = safeReadJson(STORE_FILES.commissionerAssignments) || {};

    // Filter to only this election's data
    const electionBallots = allBallots.filter((b: any) => b.electionId === electionId);
    const electionVotedStudents = allVotedStudents.filter((v: any) => v.electionId === electionId);
    const thisElectionRules = electionRules[electionId] || null;

    // Filter candidates: posts belonging to this election
    const allPosts = candidatesStore?.posts || [];
    const electionPosts = allPosts.filter((p: any) => p.electionId === electionId);

    // Org license for this org
    const orgId = `org-${instSlug}-${orgSlug}`;
    const orgLicense = orgLicenses.find((l: any) => l.id === orgId) || null;

    // Commissioner assignments for this org
    const orgCommissioners = Object.entries(commissionerAssignments)
      .filter(([, v]: [string, any]) => v.orgSlug === orgSlug && v.institutionSlug === instSlug)
      .reduce((acc: any, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});

    const bundle = {
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: "StudElect ELCOM Admin Dashboard",
        version: "1.0",
        electionId,
        orgSlug,
        instSlug,
        orgId,
      },
      electionRules: thisElectionRules,
      posts: electionPosts,
      ballots: electionBallots,
      votedStudents: electionVotedStudents,
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
 * IMPORT/RESTORE: Takes a backup bundle JSON and merges it back into the
 * live data stores. Existing data for this election is replaced, other
 * elections are untouched.
 */
export async function importElectionBackupAction(
  bundleJson: string
): Promise<{ success: boolean; message: string; summary?: any }> {
  try {
    let bundle: any;
    try {
      bundle = JSON.parse(bundleJson);
    } catch {
      return { success: false, message: "Invalid JSON — the file could not be parsed." };
    }

    const meta = bundle._meta;
    if (!meta?.electionId || !meta?.orgSlug || !meta?.instSlug) {
      return {
        success: false,
        message: "Invalid backup file — missing _meta fields (electionId, orgSlug, instSlug).",
      };
    }

    const { electionId, orgSlug, instSlug } = meta;

    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // 1. Restore election rules (merge, don't overwrite other elections)
    if (bundle.electionRules) {
      const existing = safeReadJson(STORE_FILES.electionRules) || {};
      existing[electionId] = bundle.electionRules;
      fs.writeFileSync(STORE_FILES.electionRules, JSON.stringify(existing, null, 2), "utf8");
    }

    // 2. Restore candidates/posts (replace posts for this election, keep others)
    if (bundle.posts) {
      const existing = safeReadJson(STORE_FILES.candidates) || { posts: [] };
      const otherPosts = (existing.posts || []).filter((p: any) => p.electionId !== electionId);
      existing.posts = [...otherPosts, ...bundle.posts];
      fs.writeFileSync(STORE_FILES.candidates, JSON.stringify(existing, null, 2), "utf8");
    }

    // 3. Restore ballots (merge, deduplicate by ballot id)
    if (bundle.ballots && Array.isArray(bundle.ballots)) {
      const existing = safeReadJson(STORE_FILES.ballots) || [];
      const otherBallots = existing.filter((b: any) => b.electionId !== electionId);
      const merged = [...otherBallots, ...bundle.ballots];
      fs.writeFileSync(STORE_FILES.ballots, JSON.stringify(merged, null, 2), "utf8");
    }

    // 4. Restore voted-students (merge, deduplicate)
    if (bundle.votedStudents && Array.isArray(bundle.votedStudents)) {
      const existing = safeReadJson(STORE_FILES.votedStudents) || [];
      const otherVoted = existing.filter((v: any) => v.electionId !== electionId);
      const merged = [...otherVoted, ...bundle.votedStudents];
      fs.writeFileSync(STORE_FILES.votedStudents, JSON.stringify(merged, null, 2), "utf8");
    }

    // 5. Restore org license (upsert)
    if (bundle.orgLicense) {
      const existing = safeReadJson(STORE_FILES.orgLicenses) || [];
      const orgId = `org-${instSlug}-${orgSlug}`;
      const idx = existing.findIndex((l: any) => l.id === orgId);
      if (idx >= 0) {
        existing[idx] = bundle.orgLicense;
      } else {
        existing.push(bundle.orgLicense);
      }
      fs.writeFileSync(STORE_FILES.orgLicenses, JSON.stringify(existing, null, 2), "utf8");
    }

    // 6. Restore commissioner assignments (merge)
    if (bundle.commissionerAssignments && Object.keys(bundle.commissionerAssignments).length > 0) {
      const existing = safeReadJson(STORE_FILES.commissionerAssignments) || {};
      Object.assign(existing, bundle.commissionerAssignments);
      fs.writeFileSync(STORE_FILES.commissionerAssignments, JSON.stringify(existing, null, 2), "utf8");
    }

    revalidatePath("/[institution]/admin");
    revalidatePath("/[institution]/[organization]");

    const summary = {
      postsRestored: bundle.posts?.length || 0,
      candidatesRestored: (bundle.posts || []).reduce(
        (a: number, p: any) => a + (p.candidates?.length || 0),
        0
      ),
      ballotsRestored: bundle.ballots?.length || 0,
      votedStudentsRestored: bundle.votedStudents?.length || 0,
    };

    return {
      success: true,
      message: `Election data restored successfully for ${orgSlug.toUpperCase()} (${electionId}).`,
      summary,
    };
  } catch (err: any) {
    console.error("importElectionBackupAction error:", err);
    return { success: false, message: err.message || "Restore failed" };
  }
}
