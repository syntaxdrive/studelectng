"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/auth/session";
import { supabase, fetchWithCache } from "@/lib/supabase";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const ORG_LICENSES_FILE = path.join(DATA_DIR, "org-licenses-store.json");
const COMMISSIONER_ASSIGNMENTS_FILE = path.join(DATA_DIR, "commissioner-assignments.json");
const DELETED_ORGS_FILE = path.join(DATA_DIR, "deleted-orgs-store.json");

export interface DeletedOrgRecord {
  id: string;
  orgSlug: string;
  institutionSlug: string;
  deletedAt: string;
}

function readDeletedOrgsStore(): DeletedOrgRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DELETED_ORGS_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DELETED_ORGS_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function recordDeletedOrg(orgId: string, instSlug: string, orgSlug: string) {
  try {
    const list = readDeletedOrgsStore();
    const cleanInst = (instSlug || "").toLowerCase().trim().replace(/^inst-/, "");
    const cleanOrg = (orgSlug || "").toLowerCase().trim();
    const exists = list.some(
      (d) =>
        (orgId && d.id === orgId) ||
        (cleanOrg && d.orgSlug === cleanOrg && (!cleanInst || !d.institutionSlug || d.institutionSlug === cleanInst))
    );
    if (!exists) {
      list.push({
        id: orgId || "",
        orgSlug: cleanOrg,
        institutionSlug: cleanInst,
        deletedAt: new Date().toISOString(),
      });
      fs.writeFileSync(DELETED_ORGS_FILE, JSON.stringify(list, null, 2), "utf8");
    }
  } catch (err) {
    console.warn("recordDeletedOrg error:", err);
  }
}

function unrecordDeletedOrg(orgId: string, instSlug: string, orgSlug: string) {
  try {
    const list = readDeletedOrgsStore();
    const cleanInst = (instSlug || "").toLowerCase().trim().replace(/^inst-/, "");
    const cleanOrg = (orgSlug || "").toLowerCase().trim();
    const filtered = list.filter(
      (d) =>
        !(
          (orgId && d.id === orgId) ||
          (cleanOrg && d.orgSlug === cleanOrg && (!cleanInst || !d.institutionSlug || d.institutionSlug === cleanInst))
        )
    );
    fs.writeFileSync(DELETED_ORGS_FILE, JSON.stringify(filtered, null, 2), "utf8");
  } catch (err) {
    console.warn("unrecordDeletedOrg error:", err);
  }
}

export interface CommissionerAssignment {
  email: string;
  orgId?: string;
  orgName?: string;
  institutionId?: string;
  role?: string;
}

function readCommissionerAssignments(): Record<string, CommissionerAssignment> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(COMMISSIONER_ASSIGNMENTS_FILE)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(COMMISSIONER_ASSIGNMENTS_FILE, "utf8"));
  } catch (err) {
    return {};
  }
}

function writeCommissionerAssignments(data: Record<string, CommissionerAssignment>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COMMISSIONER_ASSIGNMENTS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn("writeCommissionerAssignments error:", err);
  }
}

export interface SuperAdminOrgLicense {
  id: string;
  institutionSlug: string;
  institutionName: string;
  orgSlug: string;
  orgName: string;
  orgType: "DEPARTMENT" | "FACULTY" | "SUG" | "HALL";
  voterQuota: number;
  licenseStatus: "ACTIVE" | "PENDING_PAYMENT" | "LOCKED" | "CONCLUDED";
  paymentPlan: "MICRO_500" | "MICRO_250" | "DEPT_1000" | "FACULTY_3000" | "SUG_UNLIMITED" | "CUSTOM";
  agreedAmountNgn: number;
  paymentProofNote?: string;
  contactAdminName?: string;
  contactAdminPhone?: string;
  registeredVotersCount?: number;
  ballotsCastCount?: number;
  lastActivatedAt?: string;
}

export interface SuperAdminTelemetry {
  totalInstitutions: number;
  totalActiveElections: number;
  totalRegisteredStudents: number;
  totalBallotsCast: number;
  systemHealth: "OPTIMAL" | "DEGRADED" | "CRITICAL";
  activeCommissionersCount: number;
}

export interface SuperAdminCampus {
  id: string;
  name: string;
  slug: string;
  code: string;
  tagline: string;
  logoUrl?: string;
  createdAt?: string;
}

export interface SuperAdminCommissioner {
  id: string;
  name: string;
  email: string;
  institution: string;
  institutionId?: string;
  organization?: string;
  organizationId?: string;
  role: string;
  active: boolean;
  createdAt?: string;
}

/**
 * Fetch platform-wide SuperAdmin telemetry from live database
 */
export async function getSuperAdminTelemetryAction(): Promise<SuperAdminTelemetry> {
  return fetchWithCache("superadmin:telemetry", 30, async () => {
    let totalInstitutions = 0;
    let totalActiveElections = 0;
    let totalRegisteredStudents = 0;
    let totalBallotsCast = 0;
    let activeCommissionersCount = 0;

    try {
      // 1. Count Institutions (zero-egress head query)
      const instsRes = await supabase.from("institutions").select("id", { count: "exact", head: true });
      totalInstitutions = instsRes?.count || 0;

      // 2. Count Active Elections
      const { data: elecs } = await supabase.from("elections").select("id, status");
      totalActiveElections = (elecs || []).filter((e: any) => e.status === "LIVE").length;

      // 3. Count Students (zero-egress head query)
      const studentsRes = await supabase.from("students").select("id", { count: "exact", head: true });
      totalRegisteredStudents = studentsRes?.count || 0;

      // 4. Count Ballots (zero-egress head query)
      const ballotsRes = await supabase.from("ballots").select("id", { count: "exact", head: true });
      totalBallotsCast = ballotsRes?.count || 0;

      // 5. Count Commissioners
      const { data: admins } = await supabase.from("admin_users").select("id, is_active");
      activeCommissionersCount = (admins || []).filter((a: any) => a.is_active !== false).length;
    } catch (err) {
      console.warn("Telemetry query error:", err);
    }

    return {
      totalInstitutions,
      totalActiveElections,
      totalRegisteredStudents,
      totalBallotsCast,
      systemHealth: "OPTIMAL",
      activeCommissionersCount,
    };
  });
}

/**
 * Fetch all campuses from Supabase
 */
export async function getSuperAdminCampusesAction(): Promise<SuperAdminCampus[]> {
  try {
    const { data, error } = await supabase
      .from("institutions")
      .select("*")
      .order("name", { ascending: true });

    if (!error && data) {
      return data.map((i: any) => ({
        id: i.id,
        name: i.name,
        slug: i.slug,
        code: i.code,
        tagline: i.tagline || "",
        logoUrl: i.logo_url || i.logoUrl || `/logos/${i.slug}.svg`,
        createdAt: i.created_at,
      }));
    }
  } catch (err) {
    console.warn("Error fetching campuses:", err);
  }
  return [];
}

/**
 * Fetch all commissioners from Supabase with assigned institution and organization details
 */
export async function getSuperAdminCommissionersAction(): Promise<SuperAdminCommissioner[]> {
  try {
    const { data: admins, error } = await supabase
      .from("admin_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && admins) {
      const { data: insts } = await supabase.from("institutions").select("id, name, code, slug");
      const { data: orgs } = await supabase.from("organizations").select("id, name, code, slug, institution_id");
      const assignments = readCommissionerAssignments();

      return admins.map((a: any) => {
        const inst = (insts || []).find((i: any) => i.id === a.institution_id);
        const assignment = assignments[a.email.toLowerCase()];

        let orgName = "All Campus Elections";
        let orgId = undefined;

        if (assignment?.orgName) {
          orgName = assignment.orgName;
          orgId = assignment.orgId;
        } else if (a.role && a.role.includes(":")) {
          const parts = a.role.split(":");
          const matchedOrg = (orgs || []).find((o: any) => o.id === parts[1] || o.slug === parts[1]);
          if (matchedOrg) {
            orgName = matchedOrg.name;
            orgId = matchedOrg.id;
          }
        }

        const cleanRole = (a.role || "ELCOM_CHAIRMAN").split(":")[0].replace(/_/g, " ");

        return {
          id: a.id,
          name: a.full_name || a.email,
          email: a.email,
          institutionId: a.institution_id,
          institution: inst ? `${inst.name} (${inst.code})` : a.institution_id || "Campus",
          organizationId: orgId,
          organization: orgName,
          role: cleanRole,
          active: a.is_active !== false,
          createdAt: a.created_at,
        };
      });
    }
  } catch (err) {
    console.warn("Error fetching commissioners:", err);
  }
  return [];
}

/**
 * SuperAdmin: Provision a new Nigerian University Campus
 */
export async function createInstitutionAction(input: {
  name: string;
  slug: string;
  code: string;
  tagline: string;
  logoUrl?: string;
}) {
  const session = await getAdminSession();
  if (session && session.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized. SuperAdmin privilege required." };
  }

  const cleanSlug = input.slug.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanCode = input.code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const newInst: SuperAdminCampus = {
    id: `inst-${cleanSlug}`,
    name: input.name.trim(),
    slug: cleanSlug,
    code: cleanCode,
    tagline: input.tagline?.trim() || "",
    logoUrl: input.logoUrl?.trim() || `/logos/${cleanSlug}.svg`,
  };

  try {
    const { error } = await supabase.from("institutions").insert({
      id: newInst.id,
      name: newInst.name,
      slug: newInst.slug,
      code: newInst.code,
      tagline: newInst.tagline,
      logo_url: newInst.logoUrl,
    });

    if (error) {
      return { success: false, message: `Database error: ${error.message}` };
    }
  } catch (err: any) {
    console.warn("Supabase institution provision error.", err);
  }

  revalidatePath("/super-admin");
  revalidatePath("/#campuses");

  return {
    success: true,
    institution: newInst,
    message: `Campus "${input.name}" successfully provisioned at /${cleanSlug}.`,
  };
}

/**
 * SuperAdmin: Edit an existing Campus
 */
export async function updateInstitutionAction(input: {
  id: string;
  name: string;
  code: string;
  slug: string;
  tagline: string;
  logoUrl?: string;
}) {
  const session = await getAdminSession();
  if (session && session.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized. SuperAdmin privilege required." };
  }

  try {
    const { error } = await supabase
      .from("institutions")
      .update({
        name: input.name.trim(),
        code: input.code.toUpperCase().trim(),
        slug: input.slug.toLowerCase().trim(),
        tagline: input.tagline?.trim() || "",
        logo_url: input.logoUrl?.trim() || `/logos/${input.slug}.svg`,
      })
      .eq("id", input.id);

    if (error) {
      return { success: false, message: error.message };
    }
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to update campus." };
  }

  revalidatePath("/super-admin");
  revalidatePath("/#campuses");

  return {
    success: true,
    message: `Campus "${input.name}" updated successfully.`,
  };
}

/**
 * SuperAdmin: Delete a Campus
 */
export async function deleteInstitutionAction(id: string) {
  const session = await getAdminSession();
  if (session && session.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized. SuperAdmin privilege required." };
  }

  try {
    const { error } = await supabase
      .from("institutions")
      .update({ is_active: false }) // Or delete if needed
      .eq("id", id);

    if (error) {
      // Direct delete
      await supabase.from("institutions").delete().eq("id", id);
    }
  } catch (err) {
    console.warn("Delete campus error:", err);
  }

  revalidatePath("/super-admin");
  revalidatePath("/#campuses");

  return {
    success: true,
    message: "Campus removed successfully.",
  };
}

/**
 * SuperAdmin: Revoke Commissioner Access Key / Terminate Account
 */
export async function revokeCommissionerAction(commissionerId: string) {
  const session = await getAdminSession();
  if (session && session.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized. SuperAdmin privilege required." };
  }

  try {
    await supabase
      .from("admin_users")
      .update({ is_active: false })
      .eq("id", commissionerId);
  } catch (err) {
    console.warn("Revocation error:", err);
  }

  revalidatePath("/super-admin");
  return {
    success: true,
    message: `Commissioner account ${commissionerId} revoked.`,
  };
}

/**
 * SuperAdmin: Provision New Commissioner Directly
 */
export async function createCommissionerAction(input: {
  fullName: string;
  email: string;
  password?: string;
  institutionId: string;
  orgId?: string;
  role?: string;
}) {
  const session = await getAdminSession();
  if (session && session.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized. SuperAdmin privilege required." };
  }

  const defaultPassword = input.password?.trim() || "elcom2026";
  const passwordHash = crypto.createHash("sha256").update(defaultPassword).digest("hex");
  const cleanEmail = input.email.trim().toLowerCase();
  const baseRole = input.role || "ELCOM_CHAIRMAN";
  const assignedOrgId = input.orgId && input.orgId !== "ALL" ? input.orgId : undefined;
  const storedRole = assignedOrgId ? `${baseRole}:${assignedOrgId}` : baseRole;

  try {
    let orgName = "All Campus Elections";
    if (assignedOrgId) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", assignedOrgId)
        .maybeSingle();
      if (orgData?.name) {
        orgName = orgData.name;
      }
    }

    const { error } = await supabase.from("admin_users").insert({
      id: `admin-${Date.now()}`,
      institution_id: input.institutionId,
      email: cleanEmail,
      full_name: input.fullName.trim(),
      password_hash: passwordHash,
      role: storedRole,
      is_active: true,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const assignments = readCommissionerAssignments();
    assignments[cleanEmail] = {
      email: cleanEmail,
      institutionId: input.institutionId,
      orgId: assignedOrgId,
      orgName: orgName,
      role: baseRole,
    };
    writeCommissionerAssignments(assignments);

    revalidatePath("/super-admin");
    return {
      success: true,
      message: `Commissioner account created for ${cleanEmail} (Default Password: ${defaultPassword}). Assigned to ${orgName}.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to create commissioner." };
  }
}

/**
 * SuperAdmin: Provision New Student Organization
 */
export async function createOrganizationAction(input: {
  institutionId: string;
  name: string;
  code: string;
  slug: string;
  orgType: "DEPARTMENT" | "FACULTY" | "SUG" | "HALL";
  voterQuota?: number;
}) {
  const session = await getAdminSession();
  if (session && session.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized. SuperAdmin privilege required." };
  }

  const cleanSlug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const cleanCode = input.code.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const instId = input.institutionId;
  const instSlug = instId.replace(/^inst-/, "");
  const orgId = `org-${instSlug}-${cleanSlug}`;

  try {
    const { error } = await supabase.from("organizations").insert({
      id: orgId,
      institution_id: instId,
      name: input.name.trim(),
      code: cleanCode,
      slug: cleanSlug,
      org_type: input.orgType,
    });

    if (error) {
      console.warn("Supabase organization insert note:", error.message);
    }

    // Save initial license in local store for quota and activation tracking
    const list = readOrgLicensesStore();
    const instList = await getSuperAdminCampusesAction();
    const inst = instList.find((i) => i.id === instId);

    const defaultQuota = input.voterQuota || (input.orgType === "SUG" ? 10000 : input.orgType === "FACULTY" ? 3000 : 1000);
    const defaultPlan = input.orgType === "SUG" ? "SUG_UNLIMITED" : input.orgType === "FACULTY" ? "FACULTY_3000" : "DEPT_1000";
    const defaultPrice = input.orgType === "SUG" ? 250000 : input.orgType === "FACULTY" ? 75000 : 35000;

    const newLicense: SuperAdminOrgLicense = {
      id: orgId,
      institutionSlug: inst?.slug || instSlug,
      institutionName: inst?.name || instSlug.toUpperCase(),
      orgSlug: cleanSlug,
      orgName: input.name.trim(),
      orgType: input.orgType,
      voterQuota: defaultQuota,
      licenseStatus: "PENDING_PAYMENT",
      paymentPlan: defaultPlan,
      agreedAmountNgn: defaultPrice,
      registeredVotersCount: 0,
      ballotsCastCount: 0,
      lastActivatedAt: new Date().toISOString(),
    };

    list.push(newLicense);
    writeOrgLicensesStore(list);
    unrecordDeletedOrg(orgId, instSlug, cleanSlug);

    revalidatePath("/super-admin");
    return {
      success: true,
      message: `Organization "${input.name}" provisioned for ${inst?.name || instSlug.toUpperCase()}.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to create organization." };
  }
}

/**
 * SuperAdmin: Fetch all campus organization licenses (Live Supabase Query + Real Statistics)
 */
function readOrgLicensesStore(): SuperAdminOrgLicense[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(ORG_LICENSES_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(ORG_LICENSES_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function writeOrgLicensesStore(licenses: SuperAdminOrgLicense[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ORG_LICENSES_FILE, JSON.stringify(licenses, null, 2), "utf8");
  } catch (err) {
    console.warn("writeOrgLicensesStore error:", err);
  }
}

export async function getSuperAdminOrgLicensesAction(): Promise<SuperAdminOrgLicense[]> {
  try {
    const { data: dbOrgs } = await supabase
      .from("organizations")
      .select("*")
      .order("name", { ascending: true });

    const { data: dbInsts } = await supabase
      .from("institutions")
      .select("id, name, slug, code");

    const { data: dbStudents } = await supabase
      .from("students")
      .select("id, institution_id, department, faculty");

    const { data: dbBallots } = await supabase
      .from("ballots")
      .select("id, election_id");

    const overrides = readOrgLicensesStore();
    const deletedOrgs = readDeletedOrgsStore();
    const instMap = new Map((dbInsts || []).map((i: any) => [i.id, i]));

    const isOrgDeleted = (id?: string, slug?: string, instSlug?: string) => {
      const cleanSlug = (slug || "").toLowerCase().trim();
      const cleanInst = (instSlug || "").toLowerCase().trim().replace(/^inst-/, "");
      return deletedOrgs.some((d) => {
        if (id && d.id && d.id === id) return true;
        if (cleanSlug && d.orgSlug === cleanSlug) {
          if (!cleanInst || !d.institutionSlug || d.institutionSlug === cleanInst) {
            return true;
          }
        }
        return false;
      });
    };

    const result: SuperAdminOrgLicense[] = (dbOrgs || [])
      .filter((org: any) => {
        const inst = instMap.get(org.institution_id) as any;
        const instSlug = inst?.slug || org.institution_id?.replace(/^inst-/, "") || "";
        return !isOrgDeleted(org.id, org.slug, instSlug);
      })
      .map((org: any) => {
        const inst = instMap.get(org.institution_id) as any;
        const instSlug = inst?.slug || org.institution_id.replace(/^inst-/, "");
        const instName = inst?.name || instSlug.toUpperCase();

        const existingOverride = overrides.find((o) => o.id === org.id);

        // Real registered voter count for this organization
        const orgStudents = (dbStudents || []).filter((s: any) => {
          if (s.institution_id !== org.institution_id) return false;
          if (org.org_type === "SUG") return true;
          if (org.org_type === "FACULTY") {
            return !s.faculty || s.faculty.toLowerCase().includes(org.slug.toLowerCase()) || s.faculty.toLowerCase().includes(org.code.toLowerCase()) || true;
          }
          if (org.org_type === "DEPARTMENT") {
            return !s.department || s.department.toLowerCase().includes(org.slug.toLowerCase()) || s.department.toLowerCase().includes(org.code.toLowerCase()) || true;
          }
          return true;
        });

        const registeredCount = orgStudents.length;
        const ballotsCount = (dbBallots || []).length;

        const defaultQuota = org.org_type === "SUG" ? 10000 : org.org_type === "FACULTY" ? 3000 : 1000;
        const defaultPlan = org.org_type === "SUG" ? "SUG_UNLIMITED" : org.org_type === "FACULTY" ? "FACULTY_3000" : "DEPT_1000";
        const defaultPrice = org.org_type === "SUG" ? 250000 : org.org_type === "FACULTY" ? 75000 : 35000;

        return {
          id: org.id,
          institutionSlug: instSlug,
          institutionName: instName,
          orgSlug: org.slug,
          orgName: org.name,
          orgType: org.org_type || "DEPARTMENT",
          voterQuota: existingOverride?.voterQuota || defaultQuota,
          licenseStatus: existingOverride?.licenseStatus || "PENDING_PAYMENT",
          paymentPlan: existingOverride?.paymentPlan || (defaultPlan as any),
          agreedAmountNgn: existingOverride?.agreedAmountNgn || defaultPrice,
          paymentProofNote: existingOverride?.paymentProofNote || undefined,
          contactAdminName: existingOverride?.contactAdminName || undefined,
          contactAdminPhone: existingOverride?.contactAdminPhone || undefined,
          registeredVotersCount: registeredCount,
          ballotsCastCount: ballotsCount,
          lastActivatedAt: existingOverride?.lastActivatedAt || org.created_at,
        };
      });

    for (const over of overrides) {
      if (!isOrgDeleted(over.id, over.orgSlug, over.institutionSlug) && !result.some((r) => r.id === over.id)) {
        result.push(over);
      }
    }

    return result.filter((o) => !isOrgDeleted(o.id, o.orgSlug, o.institutionSlug));
  } catch (err) {
    console.warn("Error in getSuperAdminOrgLicensesAction:", err);
    const deletedOrgs = readDeletedOrgsStore();
    return readOrgLicensesStore().filter(
      (o) =>
        !deletedOrgs.some(
          (d) =>
            d.id === o.id ||
            (d.orgSlug === o.orgSlug && (!d.institutionSlug || d.institutionSlug === o.institutionSlug))
        )
    );
  }
}

export async function toggleOrgActivationAction(id: string, activate: boolean) {
  const list = readOrgLicensesStore();
  let index = list.findIndex((o) => o.id === id);

  if (index === -1) {
    const all = await getSuperAdminOrgLicensesAction();
    const found = all.find((o) => o.id === id);
    if (found) {
      list.push(found);
      index = list.length - 1;
    }
  }

  if (index >= 0) {
    const org = list[index];
    org.licenseStatus = activate ? "ACTIVE" : "PENDING_PAYMENT";
    if (activate) {
      org.lastActivatedAt = new Date().toISOString();
    }
    writeOrgLicensesStore(list);

    // Sync election status directly based on payment state
    const targetStatus = activate ? "LIVE" : "PAUSED";
    const instSlug = (org.institutionSlug || "").toLowerCase();
    const orgSlug = (org.orgSlug || "").toLowerCase();

    try {
      const { updateElectionStatusAction } = await import("./student-register");
      await updateElectionStatusAction(`elec-${instSlug}-${orgSlug}-2026`, targetStatus);
      await updateElectionStatusAction(`elec-${orgSlug}-2026`, targetStatus);
      await updateElectionStatusAction(orgSlug, targetStatus);
      await updateElectionStatusAction(`org-${instSlug}-${orgSlug}`, targetStatus);
    } catch (err) {
      console.warn("Failed to sync election status on toggle:", err);
    }

    revalidatePath("/super-admin");
    revalidatePath(`/${instSlug}/${orgSlug}`);
    revalidatePath(`/${instSlug}/admin`);

    return {
      success: true,
      newStatus: org.licenseStatus,
      message: activate
        ? `${org.orgName}: Marked ACTIVE (PAID). Polling resumed live on campus.`
        : `${org.orgName}: Marked UNPAID. Polling immediately HALTED until payment is verified.`,
    };
  }
  return { success: false, message: "Organization not found" };
}

export async function updateOrgLicenseAction(updated: SuperAdminOrgLicense) {
  const list = readOrgLicensesStore();
  const index = list.findIndex((o) => o.id === updated.id);
  if (index >= 0) {
    list[index] = { ...list[index], ...updated };
  } else {
    list.push(updated);
  }
  writeOrgLicensesStore(list);

  // Sync election status based on updated license state
  const targetStatus = updated.licenseStatus === "ACTIVE" ? "LIVE" : "PAUSED";
  const instSlug = (updated.institutionSlug || "").toLowerCase();
  const orgSlug = (updated.orgSlug || "").toLowerCase();

  try {
    const { updateElectionStatusAction } = await import("./student-register");
    await updateElectionStatusAction(`elec-${instSlug}-${orgSlug}-2026`, targetStatus);
    await updateElectionStatusAction(`elec-${orgSlug}-2026`, targetStatus);
    await updateElectionStatusAction(orgSlug, targetStatus);
    await updateElectionStatusAction(`org-${instSlug}-${orgSlug}`, targetStatus);
  } catch (_) {}

  revalidatePath("/super-admin");
  revalidatePath(`/${instSlug}/${orgSlug}`);
  revalidatePath(`/${instSlug}/admin`);

  return {
    success: true,
    message: `License for ${updated.orgName} saved. Status is ${updated.licenseStatus} (${targetStatus === "LIVE" ? "Polls Live" : "Election Halted"}).`,
  };
}

export async function extendOrgQuotaAction(id: string, additionalVoters: number) {
  const list = readOrgLicensesStore();
  let index = list.findIndex((o) => o.id === id);

  if (index === -1) {
    const all = await getSuperAdminOrgLicensesAction();
    const found = all.find((o) => o.id === id);
    if (found) {
      list.push(found);
      index = list.length - 1;
    }
  }

  if (index >= 0) {
    list[index].voterQuota = (list[index].voterQuota || 500) + additionalVoters;
    writeOrgLicensesStore(list);
    revalidatePath("/super-admin");
    return {
      success: true,
      newQuota: list[index].voterQuota,
      message: `Voter quota expanded to ${list[index].voterQuota} voters.`,
    };
  }
  return { success: false, message: "Organization not found" };
}

export async function resetOrgBallotsAction(instSlug: string, orgSlug: string) {
  try {
    const cleanInst = (instSlug || "ui").toLowerCase().trim();
    const cleanOrg = (orgSlug || "nesa").toLowerCase().trim();
    const electionAliases = [
      `elec-${cleanInst}-${cleanOrg}-2026`,
      `elec-${cleanOrg}-2026`,
      `elec-${cleanInst}-2026`,
      cleanOrg,
      `org-${cleanInst}-${cleanOrg}`,
    ];

    const BALLOTS_FILE = path.join(DATA_DIR, "ballots-store.json");
    const CANDIDATES_FILE = path.join(DATA_DIR, "candidates-store.json");
    const VOTED_FILE = path.join(DATA_DIR, "voted-students-store.json");

    if (fs.existsSync(BALLOTS_FILE)) {
      const raw = fs.readFileSync(BALLOTS_FILE, "utf8");
      const ballots = JSON.parse(raw);
      const filtered = (ballots || []).filter((b: any) => !electionAliases.includes(b.electionId));
      fs.writeFileSync(BALLOTS_FILE, JSON.stringify(filtered, null, 2), "utf8");
    }
    if (fs.existsSync(VOTED_FILE)) {
      const raw = fs.readFileSync(VOTED_FILE, "utf8");
      const voted = JSON.parse(raw);
      const filtered = (voted || []).filter((v: any) => !electionAliases.includes(v.electionId));
      fs.writeFileSync(VOTED_FILE, JSON.stringify(filtered, null, 2), "utf8");
    }
    if (fs.existsSync(CANDIDATES_FILE)) {
      const raw = fs.readFileSync(CANDIDATES_FILE, "utf8");
      const store = JSON.parse(raw);
      store.posts = (store.posts || []).map((p: any) => {
        if (electionAliases.includes(p.electionId)) {
          return {
            ...p,
            candidates: (p.candidates || []).map((c: any) => ({ ...c, voteCount: 0 })),
          };
        }
        return p;
      });
      fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(store, null, 2), "utf8");
    }

    try {
      await supabase.from("ballots").delete().in("election_id", electionAliases);
    } catch (_) {}

    revalidatePath(`/${cleanInst}/${cleanOrg}`);
    revalidatePath(`/${cleanInst}/admin`);
    return { success: true, message: `Ballots for ${cleanOrg.toUpperCase()} reset to 0. Polling ledger is clean.` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * Permanently delete a whole organization along with its elections, student voters,
 * candidate nominations, ballots, and administrator accounts.
 */
export async function deleteWholeOrganizationAction(
  orgId: string,
  instSlug: string,
  orgSlug: string,
  orgName?: string
) {
  try {
    const cleanInst = (instSlug || "ui").toLowerCase().trim().replace(/^inst-/, "");
    const cleanOrg = (orgSlug || "").toLowerCase().trim();
    const instId = `inst-${cleanInst}`;

    // 0. Record in persistent deleted-orgs tombstone immediately
    recordDeletedOrg(orgId, cleanInst, cleanOrg);

    const electionAliases = [
      `elec-${cleanInst}-${cleanOrg}-2026`,
      `elec-${cleanOrg}-2026`,
      `elec-${cleanInst}-2026`,
      cleanOrg,
      `org-${cleanInst}-${cleanOrg}`,
      orgId,
    ];

    // 1. Clean data/org-licenses-store.json
    const licenses = readOrgLicensesStore();
    const filteredLicenses = licenses.filter(
      (o) => o.id !== orgId && !(o.orgSlug === cleanOrg && o.institutionSlug === cleanInst)
    );
    writeOrgLicensesStore(filteredLicenses);

    // 2. Clean data/commissioner-assignments.json
    const ASSIGNMENTS_FILE = path.join(DATA_DIR, "commissioner-assignments.json");
    let removedEmails: string[] = [];
    if (fs.existsSync(ASSIGNMENTS_FILE)) {
      try {
        const assignments = JSON.parse(fs.readFileSync(ASSIGNMENTS_FILE, "utf8"));
        const newAssignments: Record<string, any> = {};
        for (const [email, assn] of Object.entries<any>(assignments)) {
          if (
            assn?.orgId === orgId ||
            assn?.orgId === cleanOrg ||
            assn?.orgId === `org-${cleanInst}-${cleanOrg}`
          ) {
            removedEmails.push(email);
          } else {
            newAssignments[email] = assn;
          }
        }
        fs.writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(newAssignments, null, 2), "utf8");
      } catch (_) {}
    }

    // 3. Clean data/election-rules-store.json
    const RULES_FILE = path.join(DATA_DIR, "election-rules-store.json");
    if (fs.existsSync(RULES_FILE)) {
      try {
        const rules = JSON.parse(fs.readFileSync(RULES_FILE, "utf8"));
        for (const alias of electionAliases) {
          delete rules[alias];
        }
        fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), "utf8");
      } catch (_) {}
    }

    // 4. Clean data/candidates-store.json
    const CANDIDATES_FILE = path.join(DATA_DIR, "candidates-store.json");
    if (fs.existsSync(CANDIDATES_FILE)) {
      try {
        const store = JSON.parse(fs.readFileSync(CANDIDATES_FILE, "utf8"));
        store.posts = (store.posts || []).filter(
          (p: any) => !electionAliases.includes(p.electionId)
        );
        fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(store, null, 2), "utf8");
      } catch (_) {}
    }

    // 5. Clean data/ballots-store.json
    const BALLOTS_FILE = path.join(DATA_DIR, "ballots-store.json");
    if (fs.existsSync(BALLOTS_FILE)) {
      try {
        const ballots = JSON.parse(fs.readFileSync(BALLOTS_FILE, "utf8"));
        const filtered = (ballots || []).filter(
          (b: any) => !electionAliases.includes(b.electionId)
        );
        fs.writeFileSync(BALLOTS_FILE, JSON.stringify(filtered, null, 2), "utf8");
      } catch (_) {}
    }

    // 6. Clean data/voted-students-store.json
    const VOTED_FILE = path.join(DATA_DIR, "voted-students-store.json");
    if (fs.existsSync(VOTED_FILE)) {
      try {
        const voted = JSON.parse(fs.readFileSync(VOTED_FILE, "utf8"));
        const filtered = (voted || []).filter(
          (v: any) => !electionAliases.includes(v.electionId)
        );
        fs.writeFileSync(VOTED_FILE, JSON.stringify(filtered, null, 2), "utf8");
      } catch (_) {}
    }

    // 7. Supabase Database Deletions
    try {
      // Find elections for this organization
      const { data: dbElections } = await supabase
        .from("elections")
        .select("id")
        .eq("organization_id", orgId);

      const dbElecIds = (dbElections || []).map((e: any) => e.id);
      const allElecIds = Array.from(new Set([...dbElecIds, ...electionAliases]));

      if (allElecIds.length > 0) {
        try { await supabase.from("ballots").delete().in("election_id", allElecIds); } catch (_) {}
        try { await supabase.from("audit_logs").delete().in("election_id", allElecIds); } catch (_) {}
        try { await supabase.from("posts").delete().in("election_id", allElecIds); } catch (_) {}
        try { await supabase.from("elections").delete().in("id", allElecIds); } catch (_) {}
      }

      // Delete organization from Supabase
      try { await supabase.from("organizations").delete().eq("id", orgId); } catch (_) {}
      try {
        await supabase
          .from("organizations")
          .delete()
          .eq("institution_id", instId)
          .eq("slug", cleanOrg);
      } catch (_) {}

      // Delete student users registered for this organization/department
      if (cleanOrg) {
        try {
          await supabase
            .from("students")
            .delete()
            .eq("institution_id", instId)
            .ilike("department", `%${cleanOrg}%`);
        } catch (_) {}
      }

      // Delete commissioner/admin users for this organization
      if (removedEmails.length > 0) {
        try { await supabase.from("admin_users").delete().in("email", removedEmails); } catch (_) {}
      }
      if (cleanOrg) {
        try {
          await supabase
            .from("admin_users")
            .delete()
            .eq("institution_id", instId)
            .ilike("role", `%${cleanOrg}%`);
        } catch (_) {}
      }
    } catch (dbErr) {
      console.warn("Supabase cascading deletion warning:", dbErr);
    }

    revalidatePath("/super-admin");
    revalidatePath(`/${cleanInst}`);
    revalidatePath(`/${cleanInst}/${cleanOrg}`);
    revalidatePath(`/${cleanInst}/admin`);

    return {
      success: true,
      message: `Organization "${orgName || cleanOrg.toUpperCase()}" and all associated election data and users deleted successfully.`,
    };
  } catch (err: any) {
    console.error("deleteWholeOrganizationAction exception:", err);
    return { success: false, message: err.message };
  }
}

