"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import {
  MOCK_ELECTIONS,
  MOCK_STUDENTS,
  MockCandidate,
  MockStudent,
} from "@/lib/mock-data";
import { QRCodeSVG } from "qrcode.react";
import {
  Vote,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  ArrowLeft,
  Lock,
  Check,
  Key,
  Copy,
  BarChart3,
  Search,
  Sparkles,
} from "lucide-react";
import { accreditVoterAction } from "@/app/actions/accredit";
import { castBallotAction } from "@/app/actions/vote";

export default function VotingPage({
  params,
}: {
  params: Promise<{ institution: string; electionId: string }>;
}) {
  const resolvedParams = use(params);
  const election =
    MOCK_ELECTIONS.find((e) => e.id === resolvedParams.electionId) ||
    MOCK_ELECTIONS[0];

  const [step, setStep] = useState<"LOGIN" | "BALLOT" | "REVIEW" | "RECEIPT">(
    "LOGIN"
  );

  const [matricInput, setMatricInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [disqualificationReasons, setDisqualificationReasons] = useState<
    string[]
  >([]);

  const [authenticatedStudent, setAuthenticatedStudent] =
    useState<MockStudent | null>(null);
  const [blindToken, setBlindToken] = useState<any | null>(null);

  const [selectedCandidates, setSelectedCandidates] = useState<{
    [postId: string]: string;
  }>({});

  const [receiptCode, setReceiptCode] = useState<string | null>(null);
  const [castTimestamp, setCastTimestamp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const handleAccreditation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setDisqualificationReasons([]);
    setIsLoading(true);

    const res = await accreditVoterAction({
      electionId: election.id,
      matricNo: matricInput.trim(),
      pin: pinInput.trim(),
      authMode: "PIN_SLIP",
    });

    setIsLoading(false);

    if (!res.success) {
      if ((res as any).disqualificationReasons && (res as any).disqualificationReasons.length > 0) {
        setDisqualificationReasons((res as any).disqualificationReasons);
      } else {
        setAuthError(res.message);
      }
      return;
    }

    setAuthenticatedStudent({
      matricNo: res.student!.matricNo,
      normalizedMatric: res.student!.matricNo.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
      fullName: res.student!.fullName,
      faculty: "Faculty of Science",
      department: res.student!.department,
      level: res.student!.level,
      programType: "FULL_TIME",
      isRegisteredSession: true,
      duesPaid: true,
      disciplinaryStatus: "GOOD_STANDING",
      hallOfResidence: "Jaja Hall",
      portalPin: pinInput,
      email: "",
    });

    setBlindToken(res.ballotToken);
    setStep("BALLOT");
  };

  const handleSelectCandidate = (postId: string, candidateId: string) => {
    setSelectedCandidates((prev) => ({
      ...prev,
      [postId]: candidateId,
    }));
  };

  const handleCastBallot = async () => {
    if (!blindToken) return;
    setIsLoading(true);

    const res = await castBallotAction({
      ballotToken: blindToken,
      votes: Object.entries(selectedCandidates).map(([postId, candidateId]) => ({
        postId,
        candidateId,
      })),
    });

    setIsLoading(false);

    if (res.success && res.receipt) {
      setReceiptCode(res.receipt.receiptCode);
      setCastTimestamp(res.receipt.timestamp);
      setStep("RECEIPT");
    } else {
      setAuthError(res.message || "Failed to record ballot.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Top Breadcrumbs & Election Metadata */}
      <div>
        <Link
          href={`/${resolvedParams.institution}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 mb-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Campus Portal</span>
        </Link>
        <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          {election.orgName}
        </span>
        <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">
          {election.title}
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Decoupled, verifiable cryptographic voting for the {election.academicSession} academic session.
        </p>
      </div>

      {/* Step Progress Tracker */}
      <div className="grid grid-cols-4 gap-1 text-center text-xs font-medium border-b border-zinc-200 pb-3">
        <div
          className={`p-2 rounded ${
            step === "LOGIN"
              ? "bg-zinc-900 text-white font-bold"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          1. Voter PIN
        </div>
        <div
          className={`p-2 rounded ${
            step === "BALLOT"
              ? "bg-zinc-900 text-white font-bold"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          2. Cast Votes
        </div>
        <div
          className={`p-2 rounded ${
            step === "REVIEW"
              ? "bg-zinc-900 text-white font-bold"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          3. Review
        </div>
        <div
          className={`p-2 rounded ${
            step === "RECEIPT"
              ? "bg-zinc-900 text-white font-bold"
              : "bg-zinc-100 text-zinc-600"
          }`}
        >
          4. Receipt
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: VOTER ACCREDITATION & PIN ENTRY                                  */}
      {/* ========================================================================= */}
      {step === "LOGIN" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900">
                  Step 1: Student Voter Accreditation
                </h2>
                <p className="text-zinc-500 text-xs">
                  Enter your matriculation number and 8-character voter PIN to verify constitutional eligibility.
                </p>
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {disqualificationReasons.length > 0 && (
              <div className="p-4 rounded-md bg-red-50 border border-red-200 text-red-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  <span>Constitutional Screening Failed:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  {disqualificationReasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <form onSubmit={handleAccreditation} className="space-y-4 pt-2">
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Matriculation / Registration Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 21/52HA045"
                  value={matricInput}
                  onChange={(e) => setMatricInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none uppercase font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  8-Character Voter PIN
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono text-sm"
                  required
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Don't know your PIN? Retrieve it on the{" "}
                  <Link
                    href={`/${resolvedParams.institution}`}
                    className="underline font-semibold text-zinc-900"
                  >
                    Campus Hub
                  </Link>{" "}
                  or contact your association ELCOM.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !matricInput || !pinInput}
                className="w-full py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-semibold transition flex items-center justify-center gap-2 text-xs"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isLoading ? "Verifying Eligibility..." : "Accredit & Enter Polling Booth"}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: INTERACTIVE BALLOT PAPER                                         */}
      {/* ========================================================================= */}
      {step === "BALLOT" && authenticatedStudent && (
        <div className="space-y-6">
          {/* Accredited Voter Banner */}
          <div className="p-4 rounded-lg bg-white border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-bold text-zinc-900">{authenticatedStudent.fullName}</span>
                <span className="font-mono text-zinc-500">({authenticatedStudent.matricNo})</span>
              </div>
              <p className="text-zinc-500 text-[11px] mt-0.5">
                {authenticatedStudent.department} • {authenticatedStudent.level} Level
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ Dues Cleared
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                ✓ SDC Good Standing
              </span>
            </div>
          </div>

          {/* Contested Offices */}
          <div className="space-y-6">
            {election.posts.map((post, postIndex) => (
              <div
                key={post.id}
                className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden"
              >
                <div className="bg-zinc-50 px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                      Office {postIndex + 1} of {election.posts.length}
                    </span>
                    <h2 className="text-base font-bold text-zinc-900">{post.title}</h2>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {selectedCandidates[post.id] ? "✓ Choice Made" : "Select 1 Candidate"}
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {post.candidates.map((candidate) => {
                    const isSelected = selectedCandidates[post.id] === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => handleSelectCandidate(post.id, candidate.id)}
                        className={`p-4 rounded-lg border text-left transition flex items-start gap-3 relative ${
                          isSelected
                            ? "border-zinc-900 bg-zinc-50/80 ring-1 ring-zinc-900"
                            : "border-zinc-200 hover:border-zinc-400 bg-white"
                        }`}
                      >
                        <img
                          src={candidate.photoUrl}
                          alt={candidate.fullName}
                          className="w-12 h-12 rounded-md object-cover border flex-shrink-0"
                        />

                        <div className="space-y-1 flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-zinc-900 text-sm">
                              {candidate.fullName}
                            </h3>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? "bg-zinc-900 border-zinc-900 text-white"
                                  : "border-zinc-300"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>

                          {candidate.nickname && (
                            <span className="inline-block text-[10px] font-semibold text-zinc-500">
                              "{candidate.nickname}"
                            </span>
                          )}

                          <p className="text-[11px] text-zinc-600 italic">
                            "{candidate.slogan}"
                          </p>

                          <p className="text-[11px] text-zinc-500 line-clamp-2 pt-0.5">
                            {candidate.manifesto}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
            <button
              type="button"
              onClick={() => setStep("LOGIN")}
              className="px-4 py-2 rounded-md border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => setStep("REVIEW")}
              className="px-6 py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center gap-1.5"
            >
              <span>Review Ballot & Proceed</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: REVIEW BALLOT                                                    */}
      {/* ========================================================================= */}
      {step === "REVIEW" && (
        <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-6 max-w-lg mx-auto text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
              Final Confirmation
            </span>
            <h2 className="text-lg font-bold text-zinc-900 mt-0.5">Review Your Ballot</h2>
            <p className="text-zinc-500 text-xs mt-1">
              Please verify your selected candidates. Once cast, your ballot is cryptographically sealed and cannot be changed.
            </p>
          </div>

          <div className="divide-y divide-zinc-200 border-y border-zinc-200 py-2 space-y-3">
            {election.posts.map((post) => {
              const selectedCandId = selectedCandidates[post.id];
              const cand = post.candidates.find((c) => c.id === selectedCandId);

              return (
                <div key={post.id} className="pt-3 first:pt-0 flex items-center justify-between">
                  <div>
                    <span className="text-zinc-400 uppercase font-semibold text-[10px]">{post.title}</span>
                    <p className="text-sm font-bold text-zinc-900 mt-0.5">
                      {cand ? cand.fullName : "Abstain / No Candidate Selected"}
                    </p>
                    {cand?.nickname && (
                      <span className="text-zinc-500 text-[10px]">"{cand.nickname}"</span>
                    )}
                  </div>
                  {cand && (
                    <img
                      src={cand.photoUrl}
                      alt={cand.fullName}
                      className="w-10 h-10 rounded-md object-cover border"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-md bg-zinc-100 text-xs text-zinc-700 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-zinc-900">
              <Lock className="w-3.5 h-3.5 text-zinc-800" />
              <span>Decoupled Anonymous Submission:</span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Your student identity will be stripped. Your ballot is signed with a blind cryptographic token and stored anonymously.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep("BALLOT")}
              className="px-4 py-2 rounded-md border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Modify Choices</span>
            </button>

            <button
              type="button"
              onClick={handleCastBallot}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center gap-1.5"
            >
              <Vote className="w-3.5 h-3.5" />
              <span>{isLoading ? "Encrypting & Storing Ballot..." : "Submit Official Ballot"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: OFFICIAL RECEIPT                                                 */}
      {/* ========================================================================= */}
      {step === "RECEIPT" && receiptCode && (
        <div className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm space-y-6 text-center max-w-lg mx-auto text-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900">Ballot Successfully Cast!</h2>
            <p className="text-xs text-zinc-500">
              Your ballot has been cryptographically recorded into the immutable election audit ledger.
            </p>
          </div>

          <div className="p-5 rounded-md bg-zinc-50 border border-zinc-200 space-y-4 text-left">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Cryptographic Receipt Hash:
                </span>
                <p className="text-base font-mono font-bold text-zinc-900 break-all">
                  {receiptCode}
                </p>
                <p suppressHydrationWarning className="text-[10px] text-zinc-400 font-mono">
                  Timestamp: {castTimestamp ? new Date(castTimestamp).toLocaleString("en-NG") : new Date().toLocaleString("en-NG")}
                </p>
              </div>

              <div className="bg-white p-1.5 rounded border shadow-2xs flex-shrink-0">
                <QRCodeSVG value={receiptCode} size={65} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-zinc-600">
                Save this hash code to independently verify inclusion in the public ledger.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(receiptCode);
                  setCopiedReceipt(true);
                  setTimeout(() => setCopiedReceipt(false), 2500);
                }}
                className="px-2.5 py-1 rounded bg-white border border-zinc-300 text-zinc-800 font-medium hover:bg-zinc-100 transition flex items-center gap-1 flex-shrink-0 text-[11px]"
              >
                {copiedReceipt ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Hash</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2 text-xs">
            <Link
              href={`/${resolvedParams.institution}/elections/${election.id}/results`}
              className="px-4 py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>View Live Results</span>
            </Link>

            <Link
              href={`/${resolvedParams.institution}`}
              className="px-4 py-2.5 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 font-medium transition"
            >
              Return to Campus Hub
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
