import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * StudElect Free-Tier Heartbeat Endpoint
 * Keeps the Supabase PostgreSQL database active and prevents 7-day inactivity pausing.
 * Can be called by UptimeRobot, cron-job.org, or the GitHub Actions keep-alive workflow.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    // 1-row query to touch the database engine with near-zero resource consumption
    const { data, error } = await supabase
      .from("institutions")
      .select("id")
      .limit(1);

    const latencyMs = Date.now() - startedAt;

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          database: "error",
          error: error.message,
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "active",
      database: "connected",
      recordsTouched: data?.length || 0,
      latencyMs,
      timestamp: new Date().toISOString(),
      message: "Supabase database heartbeat recorded successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        error: err.message || "Heartbeat failed",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
