"use client";

import React, { useState, useEffect, use } from "react";
import { getInstitutionBySlug } from "@/lib/db/institutions";
import { getElectionsByInstitution } from "@/lib/db/elections";
import {
  Vote,
  Search,
  ShieldCheck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react";

export default function CampusHubPage({
  params,
}: {
  params: Promise<{ institution: string }>;
}) {
  const resolvedParams = use(params);
  const instSlug = (resolvedParams?.institution || "ui").toLowerCase();
  const [institution, setInstitution] = useState<any>(null);
  const [elections, setElections] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"ELECTIONS" | "VERIFY_RECEIPT">("ELECTIONS");

  useEffect(() => {
    async function loadData() {
      const inst = await getInstitutionBySlug(instSlug);
      const elecs = await getElectionsByInstitution(instSlug);
      setInstitution(inst);
      setElections(elecs);
    }
    loadData();
  }, [instSlug]);

  if (!institution) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-xs text-zinc-500">
        Loading campus workspace...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Campus Hero Cover Banner */}
      <div className="rounded-3xl bg-zinc-900 border border-zinc-200 shadow-sm overflow-hidden relative">
        <div className="h-44 sm:h-52 w-full relative overflow-hidden">
          <img
            src={institution.coverImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80"}
            alt={`${institution.name} Campus Cover`}
            className="w-full h-full object-cover opacity-75"
            onError={(e) => {
              (e.target as any).src = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </div>

        {/* Campus Header Bar overlaid at bottom of banner */}
        <div className="p-6 sm:p-8 pt-0 relative -mt-12 flex flex-col md:flex-row md:items-end justify-between gap-4 text-white">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-2 border-white shadow-xl p-2.5 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img
                src={institution.logoUrl || `/logos/${institution.slug}.svg`}
                alt={institution.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as any).src = `/logos/${institution.slug}.svg`;
                }}
              />
            </div>
            <div className="space-y-1 pb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/20 text-white backdrop-blur-xs border border-white/20">
                  {institution.code}
                </span>
                <span className="text-xs text-zinc-300">Official Campus Election Hub</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{institution.name}</h1>
              <p className="text-xs text-zinc-300">{institution.tagline}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("ELECTIONS")}
              className="px-4 py-2.5 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 transition font-bold flex items-center gap-1.5 shadow-md"
            >
              <Vote className="w-4 h-4 text-zinc-900" />
              <span>Active Associations ({elections.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* How to Vote Quick Guide Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-xl bg-zinc-900 text-white text-xs shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center font-bold text-xs flex-shrink-0 text-white">
            1
          </div>
          <div>
            <p className="font-bold text-white text-sm">Select Your Association</p>
            <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
              Click your department (NACOS), faculty (NESA), or SUG poll below.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center font-bold text-xs flex-shrink-0 text-white">
            2
          </div>
          <div>
            <p className="font-bold text-white text-sm">Accreditation & PIN Login</p>
            <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
              Enter your accredited matric number and access PIN to unlock your encrypted ballot.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center font-bold text-xs flex-shrink-0 text-white">
            3
          </div>
          <div>
            <p className="font-bold text-white text-sm">Cast & Track Receipt</p>
            <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
              Submit your anonymous vote and copy your cryptographic receipt hash.
            </p>
          </div>
        </div>
      </div>

      {/* Campus Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("ELECTIONS")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "ELECTIONS"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Vote className="w-4 h-4" />
          <span>Active Association Elections ({elections.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("VERIFY_RECEIPT")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "VERIFY_RECEIPT"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Verify Ballot Receipt</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ACTIVE ASSOCIATION ELECTIONS */}
      {/* ========================================================================= */}
      {activeTab === "ELECTIONS" && (
        <div className="space-y-4">
          {elections.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-center space-y-2">
              <Vote className="w-8 h-8 text-zinc-400 mx-auto" />
              <div>
                <p className="text-sm font-bold text-zinc-800">No Active Elections Currently Open</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Elections for SUG, Faculty, Department, and Halls will appear here when opened by your ELCOM.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {elections.map((election) => {
                const orgCodeSlug = election.orgId
                  .replace(/^org-/, "")
                  .replace(new RegExp(`^${institution.slug}-`, "i"), "")
                  .toLowerCase() || "nesa";

                return (
                  <div
                    key={election.id}
                    className="p-5 rounded-xl bg-white border border-zinc-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-zinc-300 transition"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                            election.status === "LIVE"
                              ? "bg-zinc-900 text-white border border-zinc-900"
                              : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                          }`}
                        >
                          {election.status === "LIVE" ? "Polls Open" : "Upcoming"}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {election.academicSession}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-800 uppercase">
                            /{institution.slug}/{orgCodeSlug}
                          </span>
                          <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                            {election.orgName}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-zinc-900 mt-1">
                          {election.title}
                        </h3>
                        <p className="text-xs text-zinc-500 line-clamp-2 mt-1">
                          {election.description}
                        </p>
                      </div>

                      <div className="pt-2 flex flex-wrap gap-1.5 text-[11px] text-zinc-600">
                        {election.requireDuesPayment && (
                          <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                            Dues Required
                          </span>
                        )}
                        {election.requireFullTimeOnly && (
                          <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                            Full-Time Only
                          </span>
                        )}
                        {election.requireGoodDisciplinaryStanding && (
                          <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                            SDC Cleared
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>Accredited Electorate Only</span>
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 font-medium">
                        Private Direct Link
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* ========================================================================= */}
      {/* TAB 3: VERIFY BALLOT RECEIPT */}
      {/* ========================================================================= */}
      {activeTab === "VERIFY_RECEIPT" && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4 text-xs">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Cryptographic Audit Ledger Verification
              </h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                Verify that your ballot has been counted in the immutable Merkle tree without revealing your vote.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Ballot Receipt Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. SE-8K2P-9M4Q-7B1X"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none uppercase font-mono text-sm"
                />
              </div>

              <button
                type="button"
                className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verify on Public Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
