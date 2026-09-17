"use client";

import React, { use } from "react";
import Link from "next/link";
import { MOCK_ELECTIONS } from "@/lib/mock-data";
import {
  BarChart3,
  Users,
  Vote,
  Lock,
  Clock,
  ArrowLeft,
} from "lucide-react";

export default function ElectionResultsPage({
  params,
}: {
  params: Promise<{ institution: string; electionId: string }>;
}) {
  const resolvedParams = use(params);
  const election =
    MOCK_ELECTIONS.find((e) => e.id === resolvedParams.electionId) ||
    MOCK_ELECTIONS[0] || {
      id: resolvedParams.electionId,
      title: "Election Results",
      orgName: "General Elections",
      totalRegisteredVoters: 0,
      totalBallotsCast: 0,
      posts: [],
    };

  const turnoutPercentage =
    (election?.totalRegisteredVoters || 0) > 0
      ? (((election?.totalBallotsCast || 0) / election.totalRegisteredVoters) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <Link
            href={`/${resolvedParams.institution}`}
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Campus Overview</span>
          </Link>
          <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            {election.orgName} • Tally
          </span>
          <h1 className="text-xl font-bold text-zinc-900 mt-0.5">
            {election.title}
          </h1>
        </div>

        <Link
          href={`/${resolvedParams.institution}/elections/${election.id}/vote`}
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
            {election.totalRegisteredVoters.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white border border-zinc-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Ballots Cast</span>
          <p className="text-2xl font-bold text-zinc-900">
            {election.totalBallotsCast.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white border border-zinc-200 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Turnout</span>
          <p className="text-2xl font-bold text-zinc-900">{turnoutPercentage}%</p>
          <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-zinc-900 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${turnoutPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Results Mode Display */}
      {election.resultsVisibility === "SEALED_UNTIL_CLOSE" ? (
        <div className="p-8 rounded-lg bg-zinc-100 border border-zinc-200 text-center space-y-4 max-w-md mx-auto">
          <div className="w-10 h-10 rounded-full bg-zinc-200 text-zinc-700 mx-auto flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900">Ballots Sealed Until Close of Polls</h2>
            <p className="text-xs text-zinc-600">
              In accordance with electoral guidelines, candidate tallies remain sealed until the voting window concludes.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white border text-xs font-mono text-zinc-700">
            <Clock className="w-3.5 h-3.5" />
            <span>Ends: {new Date(election.endsAt).toLocaleTimeString("en-NG")}</span>
          </span>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-base font-bold text-zinc-900">Candidate Standings</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {election.posts.map((post) => {
              const totalVotesForPost = post.candidates.reduce(
                (sum, c) => sum + c.votes,
                0
              );

              const sortedCandidates = [...post.candidates].sort(
                (a, b) => b.votes - a.votes
              );

              return (
                <div
                  key={post.id}
                  className="p-5 rounded-lg bg-white border border-zinc-200 shadow-sm space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                    <h3 className="text-sm font-bold text-zinc-900">{post.title}</h3>
                    <span className="text-[11px] font-mono text-zinc-500">
                      {totalVotesForPost.toLocaleString()} Votes
                    </span>
                  </div>

                  <div className="space-y-4">
                    {sortedCandidates.map((cand, index) => {
                      const percentage =
                        totalVotesForPost > 0
                          ? ((cand.votes / totalVotesForPost) * 100).toFixed(1)
                          : "0.0";
                      const isLeading = index === 0 && cand.votes > 0;

                      return (
                        <div key={cand.id} className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={cand.photoUrl}
                                alt={cand.fullName}
                                className="w-7 h-7 rounded object-cover border"
                              />
                              <div>
                                <span className="font-semibold text-zinc-900">
                                  {cand.fullName}
                                </span>
                                {isLeading && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 text-[10px] font-mono">
                                    Leading
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right font-mono">
                              <span className="font-bold text-zinc-900">
                                {cand.votes.toLocaleString()}
                              </span>
                              <span className="text-zinc-500 ml-1.5">
                                ({percentage}%)
                              </span>
                            </div>
                          </div>

                          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isLeading ? "bg-zinc-900" : "bg-zinc-400"
                              }`}
                              style={{ width: `${percentage}%` }}
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
