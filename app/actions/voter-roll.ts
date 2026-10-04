"use server";

import { supabase } from "@/lib/supabase";
import { normalizeMatricNo } from "@/lib/matric-normalizer";
import { generateSingleVoterPin } from "@/lib/auth/pin-generator";
import { CANONICAL_INSTITUTIONS } from "@/lib/db/institutions";

export interface CsvStudentRow {
  matricNo: string;
  fullName: string;
  department: string;
  level: number;
  email?: string;
  phoneNumber?: string;
  programType?: "FULL_TIME" | "PART_TIME" | "DLI" | "SANDWICH";
  duesPaid?: boolean;
}

export async function importVoterRollAction(
  institutionSlugOrObj: string | { institutionSlug: string; electionId?: string; students?: CsvStudentRow[]; rows?: CsvStudentRow[] },
  electionIdOrRows?: string | CsvStudentRow[],
  maybeRows?: CsvStudentRow[]
) {
  try {
    let institutionSlug = "ui";
    let electionId = "elec-ui-2026";
    let rows: CsvStudentRow[] = [];

    if (typeof institutionSlugOrObj === "object" && institutionSlugOrObj !== null) {
      institutionSlug = institutionSlugOrObj.institutionSlug || "ui";
      electionId = institutionSlugOrObj.electionId || `elec-${institutionSlug}-2026`;
      rows = institutionSlugOrObj.students || institutionSlugOrObj.rows || [];
    } else {
      institutionSlug = institutionSlugOrObj || "ui";
      if (Array.isArray(electionIdOrRows)) {
        rows = electionIdOrRows;
        electionId = `elec-${institutionSlug}-2026`;
      } else {
        electionId = electionIdOrRows || `elec-${institutionSlug}-2026`;
        rows = maybeRows || [];
      }
    }

    const cleanInstSlug = institutionSlug.toLowerCase().trim();
    const institutionId = `inst-${cleanInstSlug}`;

    // Ensure institution exists
    const canonicalInst = CANONICAL_INSTITUTIONS.find((i) => i.slug === cleanInstSlug);
    await supabase.from("institutions").upsert({
      id: institutionId,
      name: canonicalInst?.name || (cleanInstSlug === "ui" ? "University of Ibadan" : `${cleanInstSlug.toUpperCase()} University`),
      slug: cleanInstSlug,
      code: canonicalInst?.code || cleanInstSlug.toUpperCase(),
      tagline: canonicalInst?.tagline || "Higher Education Institution",
      logo_url: canonicalInst?.logoUrl,
    });

    let importedCount = 0;
    let duesPaidCount = 0;
    let duesUnpaidCount = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    const generatedSlips: Array<{ matricNo: string; fullName: string; pin: string }> = [];

    for (const row of rows) {
      const norm = normalizeMatricNo(row.matricNo);
      if (!norm.isValid) continue;

      const plainPin = generateSingleVoterPin("ST");
      const isPaid = row.duesPaid !== false;
      if (isPaid) {
        duesPaidCount++;
      } else {
        duesUnpaidCount++;
      }

      // Check if student exists
      const { data: existing } = await supabase
        .from("students")
        .select("id, portal_pin")
        .eq("institution_id", institutionId)
        .eq("normalized_matric", norm.normalized)
        .maybeSingle();

      let studentId = existing?.id;
      const finalPin = existing?.portal_pin || plainPin;

      if (existing) {
        await supabase
          .from("students")
          .update({
            full_name: row.fullName,
            department: row.department || "General",
            level: Number(row.level) || 100,
            dues_paid: isPaid,
          })
          .eq("id", existing.id);
        updatedCount++;
      } else {
        studentId = `stud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await supabase.from("students").insert({
          id: studentId,
          institution_id: institutionId,
          matric_no: norm.raw,
          normalized_matric: norm.normalized,
          full_name: row.fullName,
          faculty: "General",
          department: row.department || "General",
          level: Number(row.level) || 100,
          email: row.email || null,
          phone_number: row.phoneNumber || null,
          program_type: row.programType || "FULL_TIME",
          dues_paid: isPaid,
          disciplinary_status: "GOOD_STANDING",
          portal_pin: finalPin,
        });
        insertedCount++;
      }

      // Create Voter Accreditation Record in Supabase
      if (electionId && studentId) {
        await supabase.from("voter_accreditations").upsert({
          id: `acc-${electionId}-${studentId}`,
          election_id: electionId,
          student_id: studentId,
          status: "ELIGIBLE",
        });
      }

      generatedSlips.push({
        matricNo: norm.raw,
        fullName: row.fullName,
        pin: finalPin,
      });

      importedCount++;
    }

    return {
      success: true,
      importedCount,
      insertedCount,
      updatedCount,
      duesPaidCount,
      duesUnpaidCount,
      generatedSlips,
      message: `Successfully synchronized ${importedCount} records (${duesPaidCount} Dues Paid ✅, ${duesUnpaidCount} Unpaid ❌).`,
    };
  } catch (error: any) {
    console.error("Voter roll import error:", error);
    return {
      success: false,
      message: error.message || "Failed to import voter roll.",
    };
  }
}
