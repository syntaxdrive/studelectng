"use server";

import { normalizeMatricNo } from "@/lib/matric-normalizer";
import { evaluateVoterEligibility } from "@/lib/eligibility-engine";
import { createBlindedBallotToken } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/security/rate-limiter";

export interface AccreditVoterInput {
  electionId: string;
  matricNo: string;
  pin: string;
  authMode?: "PIN_SLIP" | "EMAIL_OTP" | "SECRET_MATCH";
}

export async function accreditVoterAction(input: AccreditVoterInput) {
  try {
    const norm = normalizeMatricNo(input.matricNo);
    if (!norm.isValid) {
      return {
        success: false,
        message: "Invalid Nigerian matriculation number format.",
      };
    }

    // Rate limit PIN verification: max 5 attempts per 10 minutes per matric number
    const rateLimitKey = `accredit:${norm.normalized}`;
    const limit = checkRateLimit(rateLimitKey, 5, 10 * 60 * 1000);
    if (!limit.allowed) {
      return {
        success: false,
        message: `Too many failed or rapid PIN attempts for this account. Please wait ${limit.retryAfterSeconds} seconds before trying again.`,
      };
    }

    // 1. Query Supabase Students Table (with timeout — falls back gracefully)
    let student: any = null;
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("normalized_matric", norm.normalized)
        .maybeSingle();

      if (error) {
        console.warn("Supabase student lookup error:", error);
      } else {
        student = data;
      }
    } catch (fetchErr) {
      console.warn("Supabase student fetch exception:", fetchErr);
    }

    if (!student) {
      return {
        success: false,
        message: `Matriculation number "${input.matricNo}" is not registered yet for this association. Please click "New Voter? Get PIN" to activate your profile and receive your voter PIN.`,
      };
    }

    // 2. Verify PIN match
    const cleanInputPin = (input.pin || "").trim().toUpperCase();
    const cleanStudentPin = (student.portal_pin || "").trim().toUpperCase();

    if (!cleanStudentPin || cleanInputPin !== cleanStudentPin) {
      return {
        success: false,
        message:
          "Invalid Voter Access PIN. Please verify your official PIN or click 'Lookup My PIN'.",
      };
    }

    // 3. Check if already voted in this election cycle
    let alreadyVoted = false;
    let pastReceiptHash: string | undefined;

    try {
      const { hasStudentVotedAction } = await import("./vote");
      const votedCheck = await hasStudentVotedAction(input.electionId, norm.normalized);
      if (votedCheck.voted) {
        alreadyVoted = true;
        pastReceiptHash = votedCheck.record?.receiptHash;
      }
    } catch (_) {}

    if (!alreadyVoted) {
      try {
        const { data: voterAccreditation } = await supabase
          .from("voter_accreditations")
          .select("status")
          .eq("election_id", input.electionId)
          .eq("student_id", student.id)
          .maybeSingle();

        if (voterAccreditation?.status === "VOTED") {
          alreadyVoted = true;
        }
      } catch (_) {}
    }

    if (alreadyVoted) {
      return {
        success: true,
        alreadyVoted: true,
        receiptHash: pastReceiptHash,
        student: {
          id: student.id,
          matricNo: student.matric_no,
          fullName: student.full_name,
          faculty: student.faculty || "General",
          department: student.department || "General Studies",
          level: Number(student.level) || 100,
        },
        message:
          "Welcome back! You have already cast your ballot for this election. You can monitor live election standings or view your official receipt.",
      };
    }

    // 4. Evaluate Constitutional Eligibility
    const studentObj = {
      id: student.id,
      matricNo: student.matric_no,
      fullName: student.full_name,
      faculty: student.faculty || "General",
      department: student.department || "General Studies",
      level: Number(student.level) || 100,
      programType: (student.program_type as any) || "FULL_TIME",
      isRegisteredSession: student.is_registered_session !== false,
      duesPaid: student.dues_paid !== false,
      disciplinaryStatus: (student.disciplinary_status as any) || "GOOD_STANDING",
      hallOfResidence: student.hall_of_residence,
    };

    // 4. Evaluate Constitutional Eligibility & Election Status
    let rules: any = {
      status: "LIVE",
      requireDuesPayment: true,
      requireFullTimeOnly: false,
      requireGoodDisciplinaryStanding: true,
    };
    try {
      const { getElectionRulesAction } = await import("./student-register");
      const fetched = await getElectionRulesAction(input.electionId);
      if (fetched) {
        rules = fetched;
      }
    } catch (_) {}

    // Check if election is paused, concluded, or in draft
    if (rules.status === "PAUSED") {
      return {
        success: false,
        message: "Voting has been temporarily paused by the Electoral Commission (ELCOM). Please wait until polls are resumed.",
      };
    }
    if (rules.status === "CONCLUDED") {
      return {
        success: false,
        message: "This election has officially concluded. Voting is closed.",
      };
    }
    if (rules.status === "DRAFT") {
      return {
        success: false,
        message: "Polls have not commenced yet. Please wait for the official start announcement from ELCOM.",
      };
    }

    const eligibility = evaluateVoterEligibility(studentObj, {
      id: input.electionId,
      title: "Active Election",
      status: rules.status || "LIVE",
      startsAt: new Date(Date.now() - 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      requireDuesPayment: rules.requireDuesPayment,
      requireFullTimeOnly: rules.requireFullTimeOnly,
      requireGoodDisciplinaryStanding: rules.requireGoodDisciplinaryStanding,
      orgType: "DEPARTMENT",
      orgCode: "ASSOC",
    });

    if (!eligibility.isEligible) {
      return {
        success: false,
        message: `Constitutional Screening Failed: ${eligibility.reasons.join(", ")}`,
        eligibility,
      };
    }

    // 5. Generate Blinded Cryptographic Ballot Token
    const ballotToken = createBlindedBallotToken(input.electionId, student.id);

    // 6. Mark Accreditation Record in Supabase (non-blocking — fire and forget)
    try {
      const accreditationId = `acc-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`;
      supabase.from("voter_accreditations").upsert({
        id: accreditationId,
        election_id: input.electionId,
        student_id: student.id,
        status: "TOKEN_ISSUED",
        token_issued_at: new Date().toISOString(),
      });
    } catch (_) {
      // Fire-and-forget — do not block the voter
    }

    return {
      success: true,
      ballotToken,
      student: {
        id: student.id,
        matricNo: student.matric_no,
        fullName: student.full_name,
        department: student.department,
        level: student.level,
        duesPaid: student.dues_paid !== false,
        disciplinaryStatus: student.disciplinary_status || "GOOD_STANDING",
      },
      eligibility,
      message: "Accreditation verified. Polling booth unlocked.",
    };
  } catch (error: any) {
    console.error("Accreditation error:", error);
    return {
      success: false,
      message: error.message || "Accreditation service error.",
    };
  }
}
