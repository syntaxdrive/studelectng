"use server";

import { supabase, invalidateCache } from "@/lib/supabase";

export interface DatabaseStorageHealth {
  institutionsCount: number;
  organizationsCount: number;
  electionsCount: number;
  studentsCount: number;
  ballotsCount: number;
  auditLogsCount: number;
  estimatedDiskMb: number;
  maxFreeTierMb: number;
  usagePercent: number;
  storageTierStatus: "HEALTHY" | "ATTENTION" | "CRITICAL";
}

/**
 * Audit database table counts and compute free-tier storage estimation
 */
export async function getDatabaseStorageHealthAction(): Promise<DatabaseStorageHealth> {
  const maxFreeTierMb = 500; // Supabase Free Tier limit: 500MB

  try {
    const [insts, orgs, elecs, students, ballots, auditLogs] = await Promise.all([
      supabase.from("institutions").select("id", { count: "exact", head: true }),
      supabase.from("organizations").select("id", { count: "exact", head: true }),
      supabase.from("elections").select("id", { count: "exact", head: true }),
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("ballots").select("id", { count: "exact", head: true }),
      supabase.from("audit_logs").select("id", { count: "exact", head: true }),
    ]);

    const institutionsCount = insts?.count || 0;
    const organizationsCount = orgs?.count || 0;
    const electionsCount = elecs?.count || 0;
    const studentsCount = students?.count || 0;
    const ballotsCount = ballots?.count || 0;
    const auditLogsCount = auditLogs?.count || 0;

    // Estimated footprint:
    // Base Postgres system catalog: ~15 MB
    // Average student row: ~400 bytes (0.0004 MB)
    // Average ballot row: ~350 bytes (0.00035 MB)
    // Average audit log row: ~500 bytes (0.0005 MB)
    const dataMb =
      15 +
      studentsCount * 0.0004 +
      ballotsCount * 0.00035 +
      auditLogsCount * 0.0005 +
      institutionsCount * 0.002 +
      organizationsCount * 0.002 +
      electionsCount * 0.005;

    const estimatedDiskMb = Math.round(dataMb * 10) / 10;
    const usagePercent = Math.min(100, Math.round((estimatedDiskMb / maxFreeTierMb) * 100));

    let storageTierStatus: "HEALTHY" | "ATTENTION" | "CRITICAL" = "HEALTHY";
    if (usagePercent > 80) storageTierStatus = "CRITICAL";
    else if (usagePercent > 50) storageTierStatus = "ATTENTION";

    return {
      institutionsCount,
      organizationsCount,
      electionsCount,
      studentsCount,
      ballotsCount,
      auditLogsCount,
      estimatedDiskMb,
      maxFreeTierMb,
      usagePercent,
      storageTierStatus,
    };
  } catch (err: any) {
    console.warn("getDatabaseStorageHealthAction error:", err);
    return {
      institutionsCount: 0,
      organizationsCount: 0,
      electionsCount: 0,
      studentsCount: 0,
      ballotsCount: 0,
      auditLogsCount: 0,
      estimatedDiskMb: 15,
      maxFreeTierMb: 500,
      usagePercent: 3,
      storageTierStatus: "HEALTHY",
    };
  }
}

/**
 * Prune historical audit logs older than specified days to free database space
 */
export async function purgeOldAuditLogsAction(olderThanDays: number = 90) {
  try {
    const cutoffDate = new Date(Date.now() - olderThanDays * 86400000).toISOString();

    // Delete audit logs created prior to cutoffDate
    const { error } = await supabase
      .from("audit_logs")
      .delete()
      .lt("timestamp", cutoffDate);

    invalidateCache();

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: `Cleaned historical audit logs older than ${olderThanDays} days.`,
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
