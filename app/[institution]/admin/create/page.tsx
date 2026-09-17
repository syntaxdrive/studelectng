"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { initializeElectionAndAccountAction } from "@/app/actions/initialize-election";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Plus,
  Trash2,
  ShieldCheck,
  Lock,
  UserCheck,
  Building2,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  Share2,
  ExternalLink,
  QrCode,
} from "lucide-react";

interface PostDraft {
  id: string;
  title: string;
  maxSelections: number;
  allowedLevels: number[];
}

export default function InitializeElectionPage({
  params,
}: {
  params: Promise<{ institution: string }>;
}) {
  const resolvedParams = use(params);
  const instSlug = (resolvedParams?.institution || "ui").toLowerCase();
  const router = useRouter();

  // Wizard Steps: 1: COMMISSIONER ACCOUNT -> 2: ELECTION & ASSOCIATION -> 3: OFFICES & RULES -> 4: LINK SUCCESS
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Commissioner Account State
  const [commissionerName, setCommissionerName] = useState("");
  const [commissionerEmail, setCommissionerEmail] = useState("");
  const [password, setPassword] = useState("");

  // Association & Election State
  const [orgType, setOrgType] = useState<"SUG" | "FACULTY" | "DEPARTMENT" | "HALL">("DEPARTMENT");
  const [orgName, setOrgName] = useState("Nigeria Association of Computing Students (NACOS)");
  const [orgSlug, setOrgSlug] = useState("nacos");
  const [electionTitle, setElectionTitle] = useState("NACOS 2026/2027 Executive Council Elections");
  const [academicSession, setAcademicSession] = useState("2025/2026");
  const [description, setDescription] = useState("Annual elections for departmental executive leadership and parliamentarians.");
  const [startsAt, setStartsAt] = useState("2026-09-01T08:00");
  const [endsAt, setEndsAt] = useState("2026-09-01T16:00");

  // Rules
  const [resultsVisibility, setResultsVisibility] = useState<"LIVE" | "SEALED_UNTIL_CLOSE">("LIVE");
  const [authMode, setAuthMode] = useState<"PIN_SLIP" | "EMAIL_OTP" | "SECRET_MATCH">("PIN_SLIP");
  const [requireDues, setRequireDues] = useState(true);
  const [requireFullTime, setRequireFullTime] = useState(true);
  const [requireSDC, setRequireSDC] = useState(true);

  // Contested Positions
  const [posts, setPosts] = useState<PostDraft[]>([
    { id: "post-1", title: "President", maxSelections: 1, allowedLevels: [200, 300, 400] },
    { id: "post-2", title: "Vice President", maxSelections: 1, allowedLevels: [200, 300, 400] },
    { id: "post-3", title: "General Secretary", maxSelections: 1, allowedLevels: [200, 300] },
  ]);
  const [newPostTitle, setNewPostTitle] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatedStudentUrl, setGeneratedStudentUrl] = useState("");

  const handleAddPost = () => {
    if (!newPostTitle.trim()) return;
    setPosts((prev) => [
      ...prev,
      {
        id: `post-${Date.now()}`,
        title: newPostTitle.trim(),
        maxSelections: 1,
        allowedLevels: [100, 200, 300, 400, 500],
      },
    ]);
    setNewPostTitle("");
  };

  const handleRemovePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleInitializeElection = async () => {
    setError(null);
    setIsLoading(true);

    const computedOrgSlug =
      orgSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "association";

    const res = await initializeElectionAndAccountAction({
      institutionSlug: instSlug,
      commissionerName,
      commissionerEmail,
      password,
      orgType,
      orgName,
      electionTitle,
      academicSession,
      description,
      startsAt,
      endsAt,
      resultsVisibility,
      authMode,
      requireDuesPayment: requireDues,
      requireFullTimeOnly: requireFullTime,
      requireGoodDisciplinaryStanding: requireSDC,
      posts: posts.map((p) => ({
        title: p.title,
        maxSelections: p.maxSelections,
        allowedLevels: p.allowedLevels,
      })),
    });

    setIsLoading(false);

    if (res.success) {
      const fullUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/${instSlug}/${computedOrgSlug}`
          : `https://studelect.com.ng/${instSlug}/${computedOrgSlug}`;
      setGeneratedStudentUrl(fullUrl);
      setCurrentStep(4);
    } else {
      setError(res.message || "Failed to initialize election.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/${instSlug}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 mb-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Campus Portal</span>
        </Link>
        <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Electoral Commission (ELCOM) Onboarding
        </span>
        <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">
          Initialize Election & Create ELCOM Account
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Set up your official commissioner credentials and obtain your association's direct voter link.
        </p>
      </div>

      {/* Stepper Header */}
      <div className="grid grid-cols-4 gap-1 text-center text-xs font-medium border-b border-zinc-200 pb-3">
        <div className={`p-2 rounded ${currentStep === 1 ? "bg-zinc-900 text-white font-bold" : "bg-zinc-100 text-zinc-600"}`}>
          1. Commissioner Account
        </div>
        <div className={`p-2 rounded ${currentStep === 2 ? "bg-zinc-900 text-white font-bold" : "bg-zinc-100 text-zinc-600"}`}>
          2. Organization Scope
        </div>
        <div className={`p-2 rounded ${currentStep === 3 ? "bg-zinc-900 text-white font-bold" : "bg-zinc-100 text-zinc-600"}`}>
          3. Offices & Rules
        </div>
        <div className={`p-2 rounded ${currentStep === 4 ? "bg-zinc-900 text-white font-bold" : "bg-zinc-100 text-zinc-600"}`}>
          4. Student Link
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: COMMISSIONER ACCOUNT */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4 text-xs">
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            1. Electoral Commissioner Sign Up
          </h2>
          <p className="text-zinc-500 text-[11px]">
            You will use this email and password to access the ELCOM Dashboard, obtain voter links, upload voter rolls, and certify results.
          </p>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Commissioner Full Name
            </label>
            <input
              type="text"
              placeholder="e.g. Comrade Emeka Adeleke (ELCOM Chairman)"
              value={commissionerName}
              onChange={(e) => setCommissionerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Official Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. elcom@nacos.unilag.edu.ng or your email"
              value={commissionerEmail}
              onChange={(e) => setCommissionerEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Password (Min. 6 characters)
            </label>
            <input
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
              required
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-100">
            <button
              type="button"
              disabled={!commissionerName || !commissionerEmail || password.length < 6}
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>Next: Organization Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: ELECTION & ASSOCIATION DETAILS */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4 text-xs">
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            2. Organization & Student Link URL
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                Organization Tier
              </label>
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
              >
                <option value="SUG">SUG (University-Wide Apex Union)</option>
                <option value="FACULTY">Faculty Association (e.g. NESA, FASSA)</option>
                <option value="DEPARTMENT">Departmental Association (e.g. NACOS)</option>
                <option value="HALL">Hall of Residence (e.g. Jaja Hall)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                Academic Session
              </label>
              <input
                type="text"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                placeholder="e.g. 2025/2026"
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                Association Full Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Nigeria Association of Computing Students"
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                URL Slug (Shortcode)
              </label>
              <input
                type="text"
                value={orgSlug}
                onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="e.g. nacos or nesa"
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono lowercase"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                URL: /{instSlug}/{orgSlug || "slug"}
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Election Title
            </label>
            <input
              type="text"
              value={electionTitle}
              onChange={(e) => setElectionTitle(e.target.value)}
              placeholder="e.g. NACOS 2026/2027 Executive Council Elections"
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                Polls Open (Start Time)
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                Polls Close (End Time)
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50 transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>Next: Offices & Rules</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: OFFICES & RULES */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-5 text-xs">
          <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            3. Contested Offices & Screening Rules
          </h2>

          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-zinc-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-zinc-900 block">Require Association Dues Clearance</span>
                <span className="text-zinc-500 text-[11px]">Only cleared financial members can vote</span>
              </div>
              <input
                type="checkbox"
                checked={requireDues}
                onChange={(e) => setRequireDues(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-900"
              />
            </div>

            <div className="p-3 rounded-lg border border-zinc-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-zinc-900 block">Require Regular Full-Time Status</span>
                <span className="text-zinc-500 text-[11px]">Excludes Part-time/DLI students</span>
              </div>
              <input
                type="checkbox"
                checked={requireFullTime}
                onChange={(e) => setRequireFullTime(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-900"
              />
            </div>

            <div className="p-3 rounded-lg border border-zinc-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-zinc-900 block">SDC Disciplinary Clearance</span>
                <span className="text-zinc-500 text-[11px]">Blocks suspended/expelled students</span>
              </div>
              <input
                type="checkbox"
                checked={requireSDC}
                onChange={(e) => setRequireSDC(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-900"
              />
            </div>
          </div>

          {/* Add Post Box */}
          <div className="pt-2 space-y-2">
            <span className="font-bold text-zinc-900 block uppercase">Contested Positions ({posts.length})</span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Director of Socials or Sports Secretary"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddPost}
                className="px-4 py-2.5 rounded-lg bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Post</span>
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              {posts.map((p) => (
                <div key={p.id} className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50 flex items-center justify-between">
                  <span className="font-semibold text-zinc-900">{p.title}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePost(p.id)}
                    className="text-red-600 hover:text-red-800 text-[11px] font-medium"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50 transition"
            >
              Back
            </button>
            <button
              type="button"
              disabled={isLoading || posts.length === 0}
              onClick={handleInitializeElection}
              className="px-6 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-1.5 text-xs shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isLoading ? "Creating Portal & Link..." : "Create Portal & Get Student Link"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: SUCCESS & OFFICIAL LINK HAND-OFF FOR ELECTORAL COMMISSIONER      */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6 text-center max-w-xl mx-auto text-xs">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900">
              Election Portal & Direct Link Ready!
            </h2>
            <p className="text-xs text-zinc-500">
              As the Electoral Officer for <strong>{orgName}</strong>, share this link with your students.
            </p>
          </div>

          {/* Direct Link Box */}
          <div className="p-5 rounded-xl bg-zinc-900 text-white text-left space-y-4 shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                Official Student Direct Access Link:
              </span>
              <p className="font-mono text-sm font-bold text-emerald-400 break-all">
                {generatedStudentUrl}
              </p>
              <p className="text-[11px] text-zinc-400">
                Students will use this exact link to register, get their PIN, vote, and see live results.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedStudentUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }}
                className="px-4 py-2 rounded-lg bg-white text-zinc-900 font-bold hover:bg-zinc-100 transition flex items-center gap-1.5 text-xs shadow-xs"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    <span className="text-emerald-700 font-bold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-700" />
                    <span>Copy Student Link</span>
                  </>
                )}
              </button>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `🗳️ *OFFICIAL ELECTION NOTICE - ${orgName.toUpperCase()}*\nVoting & Voter Registration is now LIVE!\nClick here to get your PIN and cast your vote: ${generatedStudentUrl}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 text-xs shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share to WhatsApp Groups</span>
              </a>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-4 text-left">
            <div>
              <span className="font-bold text-zinc-900 block text-xs">Printable QR Code</span>
              <p className="text-[11px] text-zinc-500">Attach to physical notice boards and campaign flyers.</p>
            </div>
            <div className="bg-white p-1.5 rounded-lg border shadow-2xs flex-shrink-0">
              <QRCodeSVG value={generatedStudentUrl} size={60} />
            </div>
          </div>

          <div className="pt-2">
            <Link
              href={`/${instSlug}/admin`}
              className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center justify-center gap-2 text-xs shadow-xs"
            >
              <span>Enter ELCOM Management Dashboard →</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
