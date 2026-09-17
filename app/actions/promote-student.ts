"use server";

import { supabase, invalidateCache } from "@/lib/supabase";
import { normalizeMatricNo } from "@/lib/matric-normalizer";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface ToggleStudentAdminInput {
  institutionSlug: string;
  matricNo: string;
  isAdmin: boolean;
  adminRole?: "ELCOM_COMMISSIONER" | "POLLING_OFFICER" | "POLLING_AGENT" | "ELCOM_CHAIRMAN";
  orgSlug?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");

function readPromotedAdminsStore(): any[] {
  try {
    const filePath = path.join(DATA_DIR, "promoted-admins-store.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (_) {}
  return [];
}

function writePromotedAdminsStore(list: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const filePath = path.join(DATA_DIR, "promoted-admins-store.json");
    fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf8");
  } catch (_) {}
}

export async function toggleStudentAdminRoleAction(input: ToggleStudentAdminInput) {
  const norm = normalizeMatricNo(input.matricNo);
  if (!norm.isValid) {
    return {
      success: false,
      message: "Invalid matriculation number format.",
    };
  }

  const cleanInstSlug = input.institutionSlug.toLowerCase().trim();
  const institutionId = `inst-${cleanInstSlug}`;

  try {
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("institution_id", institutionId)
      .eq("normalized_matric", norm.normalized)
      .maybeSingle();

    if (studentError || !student) {
      return {
        success: false,
        message: `Student with matric ${input.matricNo} not found in voter register.`,
      };
    }

    let email = (student.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      email = `${norm.normalized.toLowerCase().replace(/[^a-z0-9]/g, "")}@${cleanInstSlug}.edu.ng`;
      // Sync back to student profile
      try {
        await supabase.from("students").update({ email }).eq("id", student.id);
      } catch (_) {}
    }

    // Map strictly to valid Postgres enum: 'SUPER_ADMIN', 'INSTITUTION_ADMIN', 'ELCOM_CHAIRMAN', 'RETURNING_OFFICER', 'POLLING_AGENT'
    const validRole: "POLLING_AGENT" | "ELCOM_CHAIRMAN" =
      input.adminRole === "ELCOM_COMMISSIONER" || input.adminRole === "ELCOM_CHAIRMAN"
        ? "ELCOM_CHAIRMAN"
        : "POLLING_AGENT";

    // 1. Update local persistent store for instant cross-serverless resilience
    let promotedList = readPromotedAdminsStore();
    if (input.isAdmin) {
      promotedList = promotedList.filter((p) => p.matricNo !== student.matric_no && p.email !== email && p.id !== student.id);
      promotedList.push({
        id: student.id,
        matricNo: student.matric_no,
        normalizedMatric: norm.normalized,
        fullName: student.full_name,
        email,
        institutionSlug: cleanInstSlug,
        institutionId,
        role: validRole,
        promotedAt: new Date().toISOString(),
      });
    } else {
      promotedList = promotedList.filter((p) => p.matricNo !== student.matric_no && p.email !== email && p.id !== student.id);
    }
    writePromotedAdminsStore(promotedList);

    // 2. Update Supabase admin_users table
    if (input.isAdmin) {
      const defaultPasswordHash = crypto.createHash("sha256").update("elcom2026").digest("hex");

      // Check if an admin record already exists for this email
      const { data: existingAdmin } = await supabase
        .from("admin_users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      const adminId = existingAdmin?.id || `admin-${student.id}`;

      const { error: upsertError } = await supabase.from("admin_users").upsert({
        id: adminId,
        institution_id: institutionId,
        email,
        full_name: student.full_name,
        password_hash: defaultPasswordHash,
        role: validRole,
        is_active: true,
      });

      if (upsertError) {
        console.warn("Notice updating admin_users in Supabase (persisted locally):", upsertError.message);
      }
    } else {
      try {
        await supabase.from("admin_users").delete().eq("email", email);
        await supabase.from("admin_users").delete().eq("id", `admin-${student.id}`);
      } catch (_) {}
    }

    // Invalidate in-memory caches so loadVoterRoll immediately picks up the updated role
    invalidateCache();
    revalidatePath(`/${cleanInstSlug}/admin`);

    return {
      success: true,
      email,
      isAdmin: input.isAdmin,
      message: input.isAdmin
        ? `Promoted ${student.full_name} to Polling Agent / ELCOM Admin! Login Email: ${email} | Password: elcom2026`
        : `Admin privileges revoked for ${student.full_name} (${student.matric_no}). Returned to student status.`,
    };
  } catch (error: any) {
    console.warn("Toggle admin role exception:", error);
    return {
      success: false,
      message: error.message || "Failed to update admin role.",
    };
  }
}
