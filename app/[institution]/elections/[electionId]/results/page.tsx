"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Users,
  Vote,
  Lock,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { getRealtimeElectionTelemetryAction } from "@/app/actions/vote";
import { getElectionRulesAction } from "@/app/actions/student-register";

export default function ElectionResultsPage({
  params,
}: {
  params: Promise<{ institution: string; electionId: string }>;
}) {
  const resolvedParams = use(params);
  const instSlug = resolvedParams.institution;
  const electionId = resolvedParams.electionId;

  const [isLoading, setIsLoading] = useState(true);
  const [resultsVisibility, setResultsVisibility] = useState<string>("SEALED_UNTIL_CLOSE");
  const [telemetry, setTelemetry] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [rules, tel] = await Promise.all([
          getElectionRulesAction(electionId, instSlug),
          getRealtimeElectionTelemetryAction(electionId, instSlug),
        ]);
        if (isMounted) {
          const vis = rules?.resultsVisibility || "SEALED_UNTIL_CLOSE";
          setResultsVisibility(vis);
          if (tel && tel.success) {
            setTelemetry(tel);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      loadData();
    }, 6000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [electionId, instSlug]);

  const totalRegistered = telemetry?.totalRegistered || 0;
  const totalBallots = telemetry?.totalBallotsCast || 0;
  const turnoutPercentage =
    totalRegistered > 0
      ? ((totalBallots / totalRegistered) * 100).toFixed(1)
      : totalBallots > 0
      ? "100.0"
      : "0.0";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <Link
            href={`/${instSlug}`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Campus Overview</span>
          </Link>
          <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">
            {instSlug.toUpperCase()} • Official Tally
          </span>
          <h1 className="text-xl font-bold text-zinc-900 mt-0.5">
            Election Results & Standings
          </h1>
        </div>

        <Link
          href={`/${instSlug}/elections/${electionId}/vote`}
          className="px-4 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition flex items-center gap-1.5 w-fit"
        >
          <Vote className="w-3.5 h-3.5" />
          <span>Cast Ballot</span>
        </Link>
      </div>

      {/* Turnout Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-white border border-zinc-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Registered</span>
          <p className="text-2xl font-bold text-zinc-900">
            {totalRegistered.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white border border-zinc-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Ballots Cast</span>
          <p className="text-2xl font-bold text-zinc-900">
            {totalBallots.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white border border-zinc-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Turnout</span>
          <p className="text-2xl font-bold text-zinc-900">{turnoutPercentage}%</p>
          <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-zinc-900 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Number(turnoutPercentage))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Live Standings vs Sealed Notice */}
      {resultsVisibility !== "LIVE" ? (
        <div className="p-8 rounded-lg bg-zinc-100 border border-zinc-200 text-center space-y-4 max-w-md mx-auto">
          <div className="w-10 h-10 rounded-full bg-zinc-200 text-zinc-700 mx-auto flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900">Live Results Withheld by Electoral Commission</h2>
            <p className="text-xs text-zinc-600">
              Live standings are temporarily withheld to preserve election integrity. Official certified results will be published once voting concludes.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white border text-xs font-mono text-zinc-700">
            <Clock className="w-3.5 h-3.5" />
            <span>Status: Official Tally Protected</span>
          </span>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6 text-xs">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-base font-bold text-zinc-900">Certified Real-Time Candidate Standings</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Results Released</span>
            </span>
          </div>

          <div className="space-y-6">
            {(telemetry?.posts || []).map((post: any) => {
              const totalPostVotes = (post.candidates || []).reduce(
                (acc: number, c: any) => acc + (c.voteCount ?? c.votes ?? 0),
                0
              );

              return (
                <div key={post.id} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                    <h3 className="font-bold text-zinc-900 text-sm">{post.title}</h3>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {totalPostVotes} {totalPostVotes === 1 ? "vote" : "votes"} recorded
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(post.candidates || []).map((cand: any) => {
                      const votes = cand.voteCount ?? cand.votes ?? 0;
                      const pct = totalPostVotes > 0 ? Math.round((votes / totalPostVotes) * 100) : 0;

                      return (
                        <div key={cand.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-zinc-900">
                              {cand.fullName} {cand.nickname && `("${cand.nickname}")`}
                            </span>
                            <span className="font-mono text-zinc-600">
                              {votes} {votes === 1 ? "vote" : "votes"} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-zinc-900 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
