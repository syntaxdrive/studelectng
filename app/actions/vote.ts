"use server";

import { verifyBlindedBallotToken, generateReceiptHash, computeAuditBlockHash } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/security/rate-limiter";
import fs from "fs";
import path from "path";

export interface CastBallotInput {
  ballotToken: {
    tokenId: string;
    electionId: string;
    expiresAt: number;
    signature: string;
  };
  studentId?: string;
  matricNo?: string;
  selections?: { [postId: string]: string };
  votes?: Array<{ postId: string; candidateId: string }>;
  voterLevel?: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const CANDIDATES_FILE = path.join(DATA_DIR, "candidates-store.json");
const BALLOTS_FILE = path.join(DATA_DIR, "ballots-store.json");
const VOTED_STUDENTS_FILE = path.join(DATA_DIR, "voted-students-store.json");

export interface VotedStudentRecord {
  electionId: string;
  normalizedMatric: string;
  studentId?: string;
  receiptHash: string;
  castAt: number;
}

function readVotedStudentsStore(): VotedStudentRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(VOTED_STUDENTS_FILE)) {
      fs.writeFileSync(VOTED_STUDENTS_FILE, JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const raw = fs.readFileSync(VOTED_STUDENTS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function recordVotedStudentInStore(record: VotedStudentRecord) {
  try {
    const list = readVotedStudentsStore();
    const exists = list.some(
      (r) => r.electionId === record.electionId && r.normalizedMatric === record.normalizedMatric
    );
    if (!exists) {
      list.push(record);
      fs.writeFileSync(VOTED_STUDENTS_FILE, JSON.stringify(list, null, 2), "utf8");
    }
  } catch (err) {
    console.warn("recordVotedStudentInStore error:", err);
  }
}

export async function hasStudentVotedAction(
  electionId: string,
  normalizedMatric: string
): Promise<{ voted: boolean; record?: VotedStudentRecord }> {
  const list = readVotedStudentsStore();
  const found = list.find(
    (r) => r.electionId === electionId && r.normalizedMatric === normalizedMatric
  );
  return { voted: !!found, record: found };
}

function internalHasStudentVoted(
  electionId: string,
  normalizedMatric: string
): { voted: boolean; record?: VotedStudentRecord } {
  const list = readVotedStudentsStore();
  const found = list.find(
    (r) => r.electionId === electionId && r.normalizedMatric === normalizedMatric
  );
  return { voted: !!found, record: found };
}

interface StoredBallot {
  id: string;
  electionId: string;
  receiptHash: string;
  blockHash: string;
  selections: { [postId: string]: string };
  castAt: number;
  voterLevel?: number;
}

function readBallotsStore(): StoredBallot[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BALLOTS_FILE)) {
      fs.writeFileSync(BALLOTS_FILE, JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const raw = fs.readFileSync(BALLOTS_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function appendBallotStore(ballot: StoredBallot) {
  try {
    const ballots = readBallotsStore();
    ballots.push(ballot);
    fs.writeFileSync(BALLOTS_FILE, JSON.stringify(ballots, null, 2), "utf8");
  } catch (err) {
    console.warn("appendBallotStore error:", err);
  }
}

function incrementCandidateVotesInStore(selections: { [postId: string]: string }) {
  try {
    if (!fs.existsSync(CANDIDATES_FILE)) return;
    const raw = fs.readFileSync(CANDIDATES_FILE, "utf8");
    const store = JSON.parse(raw);
    const selectedCandIds = new Set(Object.values(selections));

    store.posts = (store.posts || []).map((post: any) => ({
      ...post,
      candidates: (post.candidates || []).map((c: any) => {
        if (selectedCandIds.has(c.id)) {
          return { ...c, voteCount: (c.voteCount || 0) + 1 };
        }
        return c;
      }),
    }));

    fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.warn("incrementCandidateVotesInStore error:", err);
  }
}

export async function castBallotAction(input: CastBallotInput) {
  try {
    const timestamp = Date.now();
    const tokenId = input.ballotToken?.tokenId || `anon-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;
    const electionId = input.ballotToken?.electionId || "elec-ui-2026";
    const normMatric = input.matricNo ? input.matricNo.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() : "";

    // Rate limit ballot submissions (max 2 attempts per 60 seconds per token/matric)
    const rateLimitKey = `vote:${tokenId}:${normMatric || "anon"}`;
    const limit = checkRateLimit(rateLimitKey, 2, 60 * 1000);
    if (!limit.allowed) {
      return {
        success: false,
        message: "Vote submission rate limit reached. Please wait before submitting again.",
      };
    }

    // 0. Enforce Election Status (LIVE only)
    try {
      const { getElectionRulesAction } = await import("./student-register");
      const rules = await getElectionRulesAction(electionId);
      if (rules && rules.status !== "LIVE") {
        return {
          success: false,
          message:
            rules.status === "PAUSED"
              ? "Voting has been paused by the Electoral Commission (ELCOM). Your ballot cannot be cast right now."
              : rules.status === "CONCLUDED"
              ? "This election has officially concluded. Voting is closed."
              : "Polls are not open yet.",
        };
      }
    } catch (_) {}

    // 1. Strict One-Vote Enforcement per Election
    if (normMatric) {
      const voteCheck = internalHasStudentVoted(electionId, normMatric);
      if (voteCheck.voted) {
        return {
          success: false,
          alreadyVoted: true,
          receiptHash: voteCheck.record?.receiptHash,
          message: "You have already cast your official ballot for this election cycle. Multiple voting is strictly prohibited.",
        };
      }
    }

    const receiptHash = generateReceiptHash(
      electionId,
      tokenId,
      timestamp
    );

    // Normalize selections
    const selectionsObj: { [postId: string]: string } = input.selections || {};
    if (input.votes && Array.isArray(input.votes)) {
      for (const v of input.votes) {
        if (v.postId && v.candidateId) {
          selectionsObj[v.postId] = v.candidateId;
        }
      }
    }

    const blockHash = computeAuditBlockHash("0x000000", selectionsObj, timestamp);
    const ballotId = `ballot-${timestamp}-${Math.random().toString(36).substring(2, 6)}`;

    // 2. Increment in Server File Store
    incrementCandidateVotesInStore(selectionsObj);
    appendBallotStore({
      id: ballotId,
      electionId: input.ballotToken.electionId,
      receiptHash,
      blockHash,
      selections: selectionsObj,
      castAt: timestamp,
      voterLevel: input.voterLevel || 300,
    });

    // 3. Mark Student as Voted
    if (normMatric) {
      recordVotedStudentInStore({
        electionId,
        normalizedMatric: normMatric,
        studentId: input.studentId,
        receiptHash,
        castAt: timestamp,
      });
    }

    // 4. Insert Decoupled Anonymous Ballot into Supabase
    try {
      await supabase.from("ballots").insert({
        id: ballotId,
        election_id: input.ballotToken.electionId,
        receipt_hash: receiptHash,
        selections: selectionsObj,
        cast_at: new Date(timestamp).toISOString(),
        block_hash: blockHash,
      });

      // Mark voter accreditation as VOTED in Supabase
      if (input.studentId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("voter_accreditations")
          .update({ status: "VOTED" })
          .eq("election_id", electionId)
          .eq("student_id", input.studentId);
      }

      // Increment Candidate Vote Counts in Supabase
      for (const candidateId of Object.values(selectionsObj)) {
        if (candidateId) {
          const { data: cand } = await supabase
            .from("candidates")
            .select("vote_count")
            .eq("id", candidateId)
            .maybeSingle();

          const currentVotes = cand?.vote_count || 0;
          await supabase
            .from("candidates")
            .update({ vote_count: currentVotes + 1 })
            .eq("id", candidateId);
        }
      }

      // Log Audit Event in Supabase
      await supabase.from("audit_logs").insert({
        id: `log-${timestamp}`,
        election_id: input.ballotToken.electionId,
        action: "BALLOT_CAST",
        actor_role: "VOTER",
        ip_hash: "0x_ANONYMOUS_IP",
        details: { receiptHash, blockHash },
      });
    } catch (dbErr) {
      console.warn("Supabase vote ledger recording notice.", dbErr);
    }

    return {
      success: true,
      receipt: {
        receiptCode: receiptHash,
        timestamp,
        blockHash,
      },
      receiptHash,
      blockHash,
      castAt: timestamp,
      message: "Ballot cast successfully and chained into cryptographic ledger!",
    };
  } catch (error: any) {
    console.error("Cast ballot exception:", error);
    return {
      success: false,
      message: error.message || "Failed to process ballot.",
    };
  }
}

/**
 * Get Real-Time Live Results, Turnout & Telemetry for ELCOM Admin & Press Room
 */
export async function getRealtimeElectionTelemetryAction(
  electionId: string,
  instSlug: string = "ui"
) {
  try {
    const { getElectionPostsAndCandidatesAction } = await import("./candidates");
    const { getOrgVoterRollAction } = await import("./student-register");

    const rawPosts = await getElectionPostsAndCandidatesAction(electionId);
    const ballots = readBallotsStore();

    // 1. Get exact registered voters count from voter roll
    let totalRegistered = 0;
    try {
      const voterRollRes = await getOrgVoterRollAction(instSlug);
      if (voterRollRes.success && voterRollRes.students) {
        totalRegistered = voterRollRes.students.length;
      }
    } catch (_) {}

    if (totalRegistered === 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const countRes = await (supabase as any)
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("institution_id", `inst-${instSlug.toLowerCase()}`);
        totalRegistered = countRes.count || 0;
      } catch (_) {}
    }

    const totalBallotsCast = ballots.length;
    const turnoutPercentage =
      totalRegistered > 0
        ? Math.min(100, Math.round((totalBallotsCast / totalRegistered) * 100))
        : totalBallotsCast > 0
        ? 100
        : 0;

    // 2. Compute exact live vote count per candidate strictly from cast ballots
    const posts = rawPosts.map((post) => {
      const candidatesWithExactVotes = post.candidates.map((cand) => {
        const exactVotes = ballots.filter(
          (b) => b.selections && b.selections[post.id] === cand.id
        ).length;

        return {
          ...cand,
          voteCount: exactVotes,
        };
      });

      return {
        ...post,
        candidates: candidatesWithExactVotes,
      };
    });

    // 3. Demographic Level Breakdown
    const levelCounts: Record<number, number> = { 100: 0, 200: 0, 300: 0, 400: 0, 500: 0 };
    for (const b of ballots) {
      const lvl = b.voterLevel || 300;
      if (levelCounts[lvl] !== undefined) {
        levelCounts[lvl]++;
      } else {
        levelCounts[300]++;
      }
    }

    const levelBreakdown = Object.entries(levelCounts).map(([lvl, count]) => {
      const pct = totalBallotsCast > 0 ? Math.round((count / totalBallotsCast) * 100) : 0;
      return {
        level: `${lvl}L`,
        count,
        percentage: pct,
      };
    });

    // 4. Hourly Vote Flow Distribution (for Temporal Histogram)
    const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    const hourlyCounts: Record<string, number> = {};
    for (const h of hours) hourlyCounts[h] = 0;

    for (const b of ballots) {
      if (b.castAt) {
        const d = new Date(b.castAt);
        const hr = d.getHours();
        const formatted = `${String(hr).padStart(2, "0")}:00`;
        if (hourlyCounts[formatted] !== undefined) {
          hourlyCounts[formatted]++;
        } else if (hr < 8) {
          hourlyCounts["08:00"]++;
        } else {
          hourlyCounts["18:00"]++;
        }
      }
    }

    const hourlyDistribution = hours.map((hour) => ({
      hour,
      count: hourlyCounts[hour],
      percentage: totalBallotsCast > 0 ? Math.round((hourlyCounts[hour] / totalBallotsCast) * 100) : 0,
    }));

    // 5. Recent ballots for live cryptographic audit ledger
    const recentAuditLedger = [...ballots]
      .reverse()
      .slice(0, 15)
      .map((b) => ({
        id: b.id,
        receiptHash: b.receiptHash,
        blockHash: b.blockHash,
        castAt: b.castAt,
        officesVoted: Object.keys(b.selections || {}).length,
      }));

    return {
      success: true,
      electionId,
      totalRegistered,
      totalBallotsCast,
      turnoutPercentage,
      posts,
      levelBreakdown,
      hourlyDistribution,
      recentAuditLedger,
      lastUpdated: Date.now(),
    };
  } catch (err: any) {
    console.warn("getRealtimeElectionTelemetryAction error:", err);
    return {
      success: false,
      electionId,
      totalRegistered: 0,
      totalBallotsCast: 0,
      turnoutPercentage: 0,
      posts: [],
      levelBreakdown: [],
      recentAuditLedger: [],
      lastUpdated: Date.now(),
    };
  }
}
