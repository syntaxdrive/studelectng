"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { initializeElectionAndAccountAction } from "@/app/actions/initialize-election";
import { CANONICAL_INSTITUTIONS } from "@/lib/db/institutions";
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
  Sparkles,
  Upload,
  Image as ImageIcon,
  User,
  X,
} from "lucide-react";

interface CandidateDraft {
  id: string;
  fullName: string;
  nickname?: string;
  photoUrl?: string;
  manifesto?: string;
}

interface PostDraft {
  id: string;
  title: string;
  maxSelections: number;
  allowedLevels: number[];
  candidates: CandidateDraft[];
}

export default function AdminCreateElectionPage() {
  const router = useRouter();

  // Wizard Steps: 1: CAMPUS & COMMISSIONER -> 2: ASSOCIATION & RULES -> 3: OFFICES & CANDIDATES -> 4: SUCCESS
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Campus & Commissioner State
  const [selectedCampus, setSelectedCampus] = useState("ui");
  const [commissionerName, setCommissionerName] = useState("");
  const [commissionerEmail, setCommissionerEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2: Association & Election State
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgType, setOrgType] = useState<"DEPARTMENT" | "FACULTY" | "SUG" | "HALL">("DEPARTMENT");
  const [paymentPlan, setPaymentPlan] = useState<"MICRO_500" | "DEPT_1000" | "FACULTY_3000" | "SUG_UNLIMITED">("DEPT_1000");
  const [electionTitle, setElectionTitle] = useState("");
  const [academicSession, setAcademicSession] = useState("2025/2026");
  const [requireDues, setRequireDues] = useState(true);
  const [requireFullTime, setRequireFullTime] = useState(true);
  const [requireGoodStanding, setRequireGoodStanding] = useState(true);

  // Step 3: Posts & Candidates State
  const [posts, setPosts] = useState<PostDraft[]>([
    { id: "post-1", title: "President", maxSelections: 1, allowedLevels: [], candidates: [] },
    { id: "post-2", title: "Vice President", maxSelections: 1, allowedLevels: [], candidates: [] },
    { id: "post-3", title: "General Secretary", maxSelections: 1, allowedLevels: [], candidates: [] },
  ]);
  const [newPostTitle, setNewPostTitle] = useState("");

  // Active Post for Adding Candidate Modal
  const [activePostForCandidate, setActivePostForCandidate] = useState<string | null>(null);
  const [candForm, setCandForm] = useState({
    fullName: "",
    nickname: "",
    photoUrl: "",
    manifesto: "",
  });

  // Step 4: Submission & Link Result
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleAddPost = () => {
    if (!newPostTitle.trim()) return;
    setPosts((prev) => [
      ...prev,
      {
        id: `post-${Date.now()}`,
        title: newPostTitle.trim(),
        maxSelections: 1,
        allowedLevels: [],
        candidates: [],
      },
    ]);
    setNewPostTitle("");
  };

  const handleRemovePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  // Image Upload handler for Candidate Photo
  const handleCandidatePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCandForm((prev) => ({ ...prev, photoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePostForCandidate || !candForm.fullName.trim()) return;

    const newCandidate: CandidateDraft = {
      id: `cand-${Date.now()}`,
      fullName: candForm.fullName.trim(),
      nickname: candForm.nickname.trim(),
      photoUrl: candForm.photoUrl.trim(),
      manifesto: candForm.manifesto.trim(),
    };

    setPosts((prev) =>
      prev.map((post) =>
        post.id === activePostForCandidate
          ? { ...post, candidates: [...post.candidates, newCandidate] }
          : post
      )
    );

    setCandForm({ fullName: "", nickname: "", photoUrl: "", manifesto: "" });
    setActivePostForCandidate(null);
  };

  const handleRemoveCandidate = (postId: string, candidateId: string) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, candidates: post.candidates.filter((c) => c.id !== candidateId) }
          : post
      )
    );
  };

  const handleNextFromStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissionerName || !commissionerEmail || !password) {
      setError("Please complete all commissioner fields.");
      return;
    }
    setError(null);
    setCurrentStep(2);
  };

  const handleNextFromStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !orgSlug || !electionTitle) {
      setError("Please complete all association and election fields.");
      return;
    }
    setError(null);
    setCurrentStep(3);
  };

  const handleSubmitAll = async () => {
    if (posts.length === 0) {
      setError("Please configure at least one elective office.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await initializeElectionAndAccountAction({
      institutionSlug: selectedCampus,
      commissionerName,
      commissionerEmail,
      password,
      orgName,
      orgSlug: orgSlug.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      orgType,
      paymentPlan,
      voterQuota: paymentPlan === "MICRO_500" ? 500 : paymentPlan === "FACULTY_3000" ? 3000 : paymentPlan === "SUG_UNLIMITED" ? 10000 : 1000,
      agreedAmountNgn: paymentPlan === "MICRO_500" ? 15000 : paymentPlan === "FACULTY_3000" ? 65000 : paymentPlan === "SUG_UNLIMITED" ? 150000 : 30000,
      electionTitle,
      academicSession,
      requireDuesPayment: requireDues,
      requireFullTimeOnly: requireFullTime,
      requireGoodDisciplinaryStanding: requireGoodStanding,
      posts: posts.map((p) => ({
        title: p.title,
        maxSelections: p.maxSelections,
        allowedLevels: p.allowedLevels,
      })),
    });

    setIsLoading(false);

    if (res.success && res.directStudentUrl) {
      // If any candidates were drafted in Step 3, save them in parallel
      const allDraftCandidates = posts.flatMap((p) =>
        p.candidates.map((c) => ({ ...c, postId: p.id }))
      );
      if (allDraftCandidates.length > 0) {
        try {
          const { createCandidateAction } = await import("@/app/actions/candidates");
          await Promise.allSettled(
            allDraftCandidates.map((c) =>
              createCandidateAction({
                postId: c.postId,
                fullName: c.fullName,
                nickname: c.nickname,
                photoUrl: c.photoUrl,
                manifesto: c.manifesto,
              })
            )
          );
        } catch (_) {}
      }
      setGeneratedLink(res.directStudentUrl);
      setCurrentStep(4);
    } else {
      setError(res.message || "Failed to initialize election. Please check your inputs.");
    }
  };

  const fullStudentUrl = generatedLink
    ? `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}${generatedLink}`
    : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullStudentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getWhatsAppMessage = () => {
    return encodeURIComponent(
      `📢 *OFFICIAL NOTICE: ${electionTitle.toUpperCase()}*\n\n` +
      `Dear Students & Voters,\n` +
      `Accreditation and voting for the *${orgName}* elections are now officially OPEN!\n\n` +
      `🗳️ *Access Your Ballot, Lookup Your PIN & Vote in 30 Seconds:*\n` +
      `${fullStudentUrl}\n\n` +
      `⚠️ *Requirements:* Valid Matric Number & Voter PIN (Instant self-registration available on the link).\n\n` +
      `— *Office of the Electoral Commission (ELCOM)*`
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 mb-3 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Admin Sign In</span>
        </Link>
        <span className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Electoral Commission Setup
        </span>
        <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">
          Electoral Officer Registration & Election Wizard
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Create your ELCOM credentials, configure positions, candidate photos, and constitutional rules.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
        <div
          className={`p-2.5 rounded-lg border transition ${
            currentStep === 1
              ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
              : currentStep > 1
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-zinc-100 text-zinc-500 border-zinc-200"
          }`}
        >
          1. Commissioner
        </div>
        <div
          className={`p-2.5 rounded-lg border transition ${
            currentStep === 2
              ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
              : currentStep > 2
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-zinc-100 text-zinc-500 border-zinc-200"
          }`}
        >
          2. Association & Rules
        </div>
        <div
          className={`p-2.5 rounded-lg border transition ${
            currentStep === 3
              ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
              : currentStep > 3
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-zinc-100 text-zinc-500 border-zinc-200"
          }`}
        >
          3. Positions & Photos
        </div>
        <div
          className={`p-2.5 rounded-lg border transition ${
            currentStep === 4
              ? "bg-zinc-900 text-white border-zinc-900 shadow-xs"
              : "bg-zinc-100 text-zinc-500 border-zinc-200"
          }`}
        >
          4. Student Link
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 1: COMMISSIONER CREDENTIALS & CAMPUS                                */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <form
          onSubmit={handleNextFromStep1}
          className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-5 text-xs"
        >
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center font-bold text-zinc-900">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Step 1: Electoral Commissioner Credentials
              </h2>
              <p className="text-zinc-500 text-xs">
                Enter your official commissioner details to create your secure ELCOM account.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Select Your University Campus
            </label>
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
            >
              {CANONICAL_INSTITUTIONS.map((inst) => (
                <option key={inst.slug} value={inst.slug}>
                  {inst.name} ({inst.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Commissioner Full Name & Title
            </label>
            <input
              type="text"
              placeholder="e.g. Comrade Oluwaseun Adeleke (ELCOM Chairman)"
              value={commissionerName}
              onChange={(e) => setCommissionerName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Official Email Address (Sign-In Username)
            </label>
            <input
              type="email"
              placeholder="e.g. elcom.nesa@ui.edu.ng or elcom@nacos.unilag.edu.ng"
              value={commissionerEmail}
              onChange={(e) => setCommissionerEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Secure Password
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

          <div className="pt-3 border-t border-zinc-100 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-2 shadow-xs"
            >
              <span>Next: Association & Rules</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: ASSOCIATION & CONSTITUTIONAL RULES                               */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <form
          onSubmit={handleNextFromStep2}
          className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-5 text-xs"
        >
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center font-bold text-zinc-900">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Step 2: Association Details & Eligibility Rules
              </h2>
              <p className="text-zinc-500 text-xs">
                Configure your association name, unique link slug, and constitutional screening rules.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                Full Association / Body Name
              </label>
              <input
                type="text"
                placeholder="e.g. Nigerian Economics Students' Association (NESA)"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
                required
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                Unique Student Link Slug
              </label>
              <div className="flex items-center rounded-lg border border-zinc-300 overflow-hidden focus-within:ring-1 focus-within:ring-zinc-900">
                <span className="px-3 py-2.5 bg-zinc-100 text-zinc-500 font-mono text-xs border-r border-zinc-300">
                  /{selectedCampus}/
                </span>
                <input
                  type="text"
                  placeholder="e.g. nesa or nacos"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="w-full px-3 py-2.5 focus:outline-none lowercase font-mono font-bold"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold uppercase text-zinc-700 mb-1">
                Association Level / Tier
              </label>
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
              >
                <option value="DEPARTMENT">Departmental Association (e.g. NACOS)</option>
                <option value="FACULTY">Faculty Association (e.g. NESA, LAWSA)</option>
                <option value="SUG">SUG Apex Student Union</option>
                <option value="HALL">Hall of Residence</option>
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
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Official Election Title
            </label>
            <input
              type="text"
              placeholder="e.g. NESA 2026/2027 Executive Council Elections"
              value={electionTitle}
              onChange={(e) => setElectionTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
              required
            />
          </div>

          {/* Price Plan Selector */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-800 uppercase tracking-wider block text-[11px]">
                Select Activation & Voter Capacity Plan:
              </span>
              <span className="text-[11px] text-zinc-500 font-medium">All platform features included in all plans</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: "MICRO_500",
                  name: "Micro Tier",
                  price: "₦15,000",
                  voters: "Up to 500 Voters",
                  badge: "Small Depts & Halls",
                  popular: false,
                },
                {
                  id: "DEPT_1000",
                  name: "Department Pro",
                  price: "₦30,000",
                  voters: "Up to 1,000 Voters",
                  badge: "Most Popular",
                  popular: true,
                },
                {
                  id: "FACULTY_3000",
                  name: "Faculty Pro",
                  price: "₦65,000",
                  voters: "Up to 3,000 Voters",
                  badge: "Full Faculties",
                  popular: false,
                },
                {
                  id: "SUG_UNLIMITED",
                  name: "SUG / Apex",
                  price: "₦150,000+",
                  voters: "3,000+ Unlimited",
                  badge: "Campus-Wide",
                  popular: false,
                },
              ].map((plan) => {
                const isSelected = paymentPlan === plan.id;
                return (
                  <div
                    key={plan.id}
                    onClick={() => {
                      setPaymentPlan(plan.id as any);
                      if (plan.id === "SUG_UNLIMITED") setOrgType("SUG");
                      else if (plan.id === "FACULTY_3000") setOrgType("FACULTY");
                      else if (plan.id === "MICRO_500" && orgType === "SUG") setOrgType("DEPARTMENT");
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition relative flex flex-col justify-between ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm ring-2 ring-zinc-900"
                        : "border-zinc-200 bg-white hover:border-zinc-400 text-zinc-900"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            isSelected
                              ? "bg-zinc-800 text-zinc-200"
                              : plan.popular
                              ? "bg-blue-100 text-blue-800 font-bold"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {plan.badge}
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <p className={`font-bold text-sm ${isSelected ? "text-white" : "text-zinc-900"}`}>
                        {plan.name}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                        {plan.voters}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-zinc-200/40 mt-3">
                      <p className={`text-base font-extrabold font-mono ${isSelected ? "text-white" : "text-zinc-900"}`}>
                        {plan.price}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Eligibility Toggles */}
          <div className="space-y-3 pt-2">
            <span className="font-semibold text-zinc-800 uppercase tracking-wider block text-[11px]">
              Constitutional Eligibility Screening Rules:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireDues}
                  onChange={(e) => setRequireDues(e.target.checked)}
                  className="mt-0.5 rounded text-zinc-900 focus:ring-zinc-900"
                />
                <div>
                  <p className="font-bold text-zinc-900">Association Dues</p>
                  <p className="text-zinc-500 text-[11px]">Require payment clearance</p>
                </div>
              </label>

              <label className="p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireFullTime}
                  onChange={(e) => setRequireFullTime(e.target.checked)}
                  className="mt-0.5 rounded text-zinc-900 focus:ring-zinc-900"
                />
                <div>
                  <p className="font-bold text-zinc-900">Full-Time Only</p>
                  <p className="text-zinc-500 text-[11px]">Exclude DLI/Sandwich</p>
                </div>
              </label>

              <label className="p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireGoodStanding}
                  onChange={(e) => setRequireGoodStanding(e.target.checked)}
                  className="mt-0.5 rounded text-zinc-900 focus:ring-zinc-900"
                />
                <div>
                  <p className="font-bold text-zinc-900">SDC Clearance</p>
                  <p className="text-zinc-500 text-[11px]">Good disciplinary standing</p>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold"
            >
              ← Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSubmitAll}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-bold transition flex items-center gap-1.5 shadow-xs"
                title="Launch with standard positions (President, VP, Sec) and add candidates later in the dashboard"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isLoading ? "Provisioning Portal..." : "Skip Candidates & Launch Portal"}</span>
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-2 shadow-xs"
              >
                <span>Customize Offices & Candidates</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: CONTESTED POSITIONS & CANDIDATE PHOTOS                            */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6 text-xs">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center font-bold text-zinc-900">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Step 3: Contested Positions & Candidates <span className="text-zinc-400 font-normal text-xs">(Optional)</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Configure elective positions. You can nominate candidates now or skip and add them later in your dashboard.
              </p>
            </div>
          </div>

          {/* Optional Banner */}
          <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs">Candidates Nomination is 100% Optional</p>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                You do not need to add candidates right now. You can skip candidate nomination and add, screen, or edit candidates anytime later from your ELCOM Admin Dashboard.
              </p>
            </div>
          </div>

          {/* Add Post Input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Public Relations Officer (PRO), Director of Sports"
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddPost();
                }
              }}
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
            />
            <button
              type="button"
              onClick={handleAddPost}
              className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Position</span>
            </button>
          </div>

          {/* Posts & Candidates List */}
          <div className="space-y-4">
            {posts.map((post, idx) => (
              <div
                key={post.id}
                className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/70 space-y-3"
              >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-zinc-900 text-white font-bold text-[11px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="font-bold text-zinc-900 text-sm">{post.title}</h3>
                      <p className="text-zinc-500 text-[10px]">
                        Single-winner office • {post.candidates.length} candidate(s) nominated
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActivePostForCandidate(post.id)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:border-zinc-500 text-zinc-800 font-bold transition flex items-center gap-1.5 text-xs shadow-xs"
                    >
                      <Plus className="w-3 h-3 text-zinc-600" />
                      <span>Nominate Candidate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemovePost(post.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Remove Position"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Candidate Cards Grid */}
                {post.candidates.length === 0 ? (
                  <div className="p-3 bg-white rounded-lg border border-dashed border-zinc-300 text-center text-[11px] text-zinc-400">
                    No candidates nominated yet for {post.title}. Click "Nominate Candidate" to add names and photos.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {post.candidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="p-3 rounded-lg bg-white border border-zinc-200 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {cand.photoUrl ? (
                              <img
                                src={cand.photoUrl}
                                alt={cand.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-zinc-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-zinc-900 text-xs truncate">{cand.fullName}</p>
                            {cand.nickname && (
                              <p className="text-[10px] text-zinc-500 font-medium truncate">
                                "{cand.nickname}"
                              </p>
                            )}
                            {cand.manifesto && (
                              <p className="text-[10px] text-zinc-400 italic truncate">
                                {cand.manifesto}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCandidate(post.id, cand.id)}
                          className="p-1 text-zinc-400 hover:text-red-600 transition"
                          title="Remove Candidate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold"
            >
              ← Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSubmitAll}
                disabled={isLoading || posts.length === 0}
                className="px-4 py-2.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Skip Candidates & Finish</span>
              </button>
              <button
                type="button"
                onClick={handleSubmitAll}
                disabled={isLoading || posts.length === 0}
                className="px-6 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold transition flex items-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isLoading
                    ? "Provisioning Election & Portal..."
                    : posts.some((p) => p.candidates.length > 0)
                    ? "Complete Setup With Nominated Candidates"
                    : "Complete Setup & Get Student Link"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: STUDENT LINK HAND-OFF SCREEN                                     */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-md space-y-6 text-xs text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase">
              PORTAL LIVE & READY
            </span>
            <h2 className="text-2xl font-bold text-zinc-900 mt-2">
              Election Initialized Successfully!
            </h2>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Your official ELCOM administrator account and the single-link student voting portal have been provisioned.
            </p>
          </div>

          {/* Student Direct Link Card */}
          <div className="p-5 rounded-xl bg-zinc-900 text-white text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Direct Student Voting & Registration Link:
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                1 LINK FOR ALL VOTERS
              </span>
            </div>

            <div className="p-3 rounded-lg bg-white/10 border border-white/10 font-mono text-sm break-all font-semibold flex items-center justify-between gap-3">
              <span>{fullStudentUrl}</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded bg-white text-zinc-900 hover:bg-zinc-100 font-bold transition flex items-center gap-1.5 text-xs flex-shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Distribute this single link to class WhatsApp groups, emails, and student portals. Students use this exact link to register, look up their PINs, vote, and view real-time results.
            </p>
          </div>

          {/* WhatsApp Broadcast & QR Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            {/* WhatsApp Share Button */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <Share2 className="w-4 h-4" />
                  <span>Share to Class WhatsApp Groups</span>
                </div>
                <p className="text-zinc-500 text-[11px]">
                  Send a pre-formatted announcement with the voting link directly to your departmental group chats.
                </p>
              </div>

              <a
                href={`https://api.whatsapp.com/send?text=${getWhatsAppMessage()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center justify-center gap-2 text-xs shadow-xs"
              >
                <span>Broadcast on WhatsApp →</span>
              </a>
            </div>

            {/* Printable QR Code */}
            <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-zinc-900">Printable Polling QR Code</p>
                  <p className="text-zinc-500 text-[11px]">Scan with phone camera to vote</p>
                </div>
                <QrCode className="w-4 h-4 text-zinc-500" />
              </div>

              <div className="p-3 bg-white rounded-lg border border-zinc-200 flex items-center justify-center">
                <QRCodeSVG value={fullStudentUrl} size={100} level="M" />
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={generatedLink}
              target="_blank"
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-800 font-bold transition flex items-center justify-center gap-2"
            >
              <span>Preview Student Portal</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </Link>

            <Link
              href={`/${selectedCampus}/admin`}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center justify-center gap-2 shadow-xs"
            >
              <span>Enter ELCOM Desk Dashboard →</span>
            </Link>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NOMINATE CANDIDATE MODAL                                                  */}
      {/* ========================================================================= */}
      {activePostForCandidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">
                  Nominate Candidate
                </h3>
                <p className="text-xs text-zinc-500">
                  Adding candidate for:{" "}
                  <strong>{posts.find((p) => p.id === activePostForCandidate)?.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePostForCandidate(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCandidate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Candidate Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Adebayo Chukwuma Olawale"
                  value={candForm.fullName}
                  onChange={(e) => setCandForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Campaign Nickname / Moniker
                </label>
                <input
                  type="text"
                  placeholder="e.g. TechVanguard"
                  value={candForm.nickname}
                  onChange={(e) => setCandForm((prev) => ({ ...prev, nickname: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              {/* Candidate Photo Upload & Preview */}
              <div className="space-y-2">
                <label className="block font-semibold uppercase text-zinc-700">
                  Candidate Photo
                </label>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {candForm.photoUrl ? (
                      <img
                        src={candForm.photoUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-zinc-400" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Paste image URL or upload below"
                      value={candForm.photoUrl}
                      onChange={(e) =>
                        setCandForm((prev) => ({ ...prev, photoUrl: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 rounded-md border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />

                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer text-[11px] font-semibold transition">
                      <Upload className="w-3 h-3 text-zinc-500" />
                      <span>Upload Photo File (JPG / PNG)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCandidatePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Campaign Slogan / Manifesto Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Digital Transformation & Academic Welfare for all students."
                  value={candForm.manifesto}
                  onChange={(e) =>
                    setCandForm((prev) => ({ ...prev, manifesto: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActivePostForCandidate(null)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Candidate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
