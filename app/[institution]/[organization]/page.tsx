"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import { getInstitutionBySlug, CANONICAL_INSTITUTIONS } from "@/lib/db/institutions";
import { MOCK_ELECTIONS, MOCK_STUDENTS, MockElection, MockStudent, MockPost, MockCandidate } from "@/lib/mock-data";
import { accreditVoterAction } from "@/app/actions/accredit";
import { castBallotAction } from "@/app/actions/vote";
import {
  registerStudentAccountAction,
  lookupStudentStatusAction,
  getElectionRulesAction,
} from "@/app/actions/student-register";
import { getElectionPostsAndCandidatesAction } from "@/app/actions/candidates";
import { useLiveElection } from "@/lib/hooks/use-live-election";
import { QRCodeSVG } from "qrcode.react";
import {
  Vote,
  Key,
  UserPlus,
  BarChart3,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Lock,
  Check,
  Search,
  Sparkles,
  Building2,
  Copy,
  AlertCircle,
  AlertTriangle,
  Clock,
  User,
  Users,
  FileText,
  MessageSquare,
} from "lucide-react";

export default function OrganizationPortalPage({
  params,
}: {
  params: Promise<{ institution: string; organization: string }>;
}) {
  const resolvedParams = use(params);
  const instSlug = (resolvedParams?.institution || "ui").toLowerCase();
  const orgSlug = (resolvedParams?.organization || "nesa").toLowerCase();

  // Route Collision Guard (e.g. /admin/create should redirect to /admin/create)
  if (instSlug === "admin" && orgSlug === "create") {
    if (typeof window !== "undefined") {
      window.location.replace("/admin/create");
    }
    return (
      <div className="max-w-xl mx-auto py-16 text-center text-xs text-zinc-500">
        Redirecting to Electoral Commissioner Setup...
      </div>
    );
  }

  const [institution, setInstitution] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"VOTE" | "CANDIDATES" | "REGISTER" | "RESULTS">("VOTE");

  // Voting Booth State (LOGIN -> BALLOT -> REVIEW -> RECEIPT)
  const [voteStep, setVoteStep] = useState<"LOGIN" | "BALLOT" | "REVIEW" | "RECEIPT">("LOGIN");
  const [matricInput, setMatricInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticatedStudent, setAuthenticatedStudent] = useState<MockStudent | null>(null);
  const [blindToken, setBlindToken] = useState<any | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<{ [postId: string]: string }>({});
  const [receiptCode, setReceiptCode] = useState<string | null>(null);
  const [castTimestamp, setCastTimestamp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const [electionStatus, setElectionStatus] = useState<string>("LIVE");
  const [resultsVisibility, setResultsVisibility] = useState<string>("LIVE");
  const [isPaymentHalted, setIsPaymentHalted] = useState<boolean>(false);

  const safeCopyToClipboard = async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      console.warn("Clipboard copy failed", err);
      return false;
    }
  };

  // Self-Register State
  const [regFullName, setRegFullName] = useState("");
  const [regMatric, setRegMatric] = useState("");
  const [regLevel, setRegLevel] = useState(300);
  const [regDept, setRegDept] = useState((orgSlug || "").toUpperCase() + " Department");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccessPin, setRegSuccessPin] = useState<string | null>(null);


  // Dynamic Association Names
  const orgNames: { [key: string]: { name: string; type: string; title: string; dept: string } } = {
    nesa: {
      name: "Nigerian Economics Students' Association (NESA)",
      type: "Departmental Association",
      title: "NESA 2026/2027 Executive Council Elections",
      dept: "Economics",
    },
    nacos: {
      name: "Nigeria Association of Computing Students (NACOS)",
      type: "Departmental Association",
      title: "NACOS 2026/2027 Executive Council Elections",
      dept: "Computer Science",
    },
    sug: {
      name: "Student Union Government (SUG)",
      type: "Apex University Union",
      title: "SUG 2026/2027 Central Executive Elections",
      dept: "University-Wide",
    },
    fassa: {
      name: "Faculty of Science Students' Association (FASSA)",
      type: "Faculty Association",
      title: "FASSA 2026/2027 Executive Council Elections",
      dept: "Faculty of Science",
    },
    lawsa: {
      name: "Law Students' Association (LAWSA)",
      type: "Faculty Association",
      title: "LAWSA 2026/2027 Executive Council Elections",
      dept: "Faculty of Law",
    },
  };

  const cleanOrgKey = (orgSlug || "").replace(new RegExp(`^${instSlug}-`, "i"), "").toLowerCase();
  const currentOrg = orgNames[cleanOrgKey] || orgNames[orgSlug] || {
    name: `${(orgSlug || "").toUpperCase()} Students' Association`,
    type: "Student Union Body",
    title: `${(orgSlug || "").toUpperCase()} 2026/2027 Elections`,
    dept: (orgSlug || "").toUpperCase(),
  };

  // Find or generate active election
  const baseElection: MockElection = useMemo(() => {
    return (
      MOCK_ELECTIONS.find((e) => e.orgId.includes(orgSlug) || e.id.includes(orgSlug)) || {
        id: `elec-${instSlug}-${orgSlug}-2026`,
        orgId: `org-${instSlug}-${orgSlug}`,
        orgName: currentOrg.name,
        orgType: "DEPARTMENT",
        title: currentOrg.title,
        academicSession: "2025/2026",
        description: `Official voting portal for ${currentOrg.name} elections.`,
        status: "LIVE",
        resultsVisibility: "LIVE",
        authMode: "PIN_SLIP",
        requireDuesPayment: true,
        requireFullTimeOnly: true,
        requireGoodDisciplinaryStanding: true,
        startsAt: "2026-09-01T08:00:00.000Z",
        endsAt: "2026-09-01T18:00:00.000Z",
        totalRegisteredVoters: 1200,
        totalAccreditedVoters: 640,
        totalBallotsCast: 580,
        posts: MOCK_ELECTIONS[0]?.posts || [],
      }
    );
  }, [orgSlug, currentOrg.name, currentOrg.title]);

  const { election } = useLiveElection(baseElection);
  const [livePosts, setLivePosts] = useState<MockPost[]>([]);

  useEffect(() => {
    async function loadPostsAndCandidates() {
      try {
        let rawData = await getElectionPostsAndCandidatesAction(`elec-${instSlug}-2026`);
        try {
          const savedPostsJson = localStorage.getItem(`studelect_posts_${instSlug}`);
          if (savedPostsJson) {
            const parsedSaved = JSON.parse(savedPostsJson);
            if (parsedSaved && parsedSaved.length > 0) {
              rawData = parsedSaved;
            }
          }
        } catch (_) {}

        if (rawData && rawData.length > 0) {
          const mapped: MockPost[] = rawData.map((p: any) => ({
            id: p.id,
            electionId: p.electionId || p.election_id || `elec-${instSlug}-2026`,
            title: p.title,
            description: p.description || "",
            maxSelections: p.maxSelections || p.max_selections || 1,
            allowedLevels: p.allowedLevels || p.allowed_levels || [],
            allowedDepartments: [],
            candidates: (p.candidates || [])
              .filter((c: any) => c.status !== "DISQUALIFIED")
              .map((c: any) => ({
                id: c.id,
                postId: c.postId || c.post_id || p.id,
                fullName: c.fullName || c.full_name,
                nickname: c.nickname,
                matricNo: c.matricNo || c.matric_no || "",
                level: 300,
                department: currentOrg.dept,
                photoUrl:
                  c.photoUrl ||
                  c.photo_url ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.fullName || c.full_name || "cand")}`,
                manifesto: c.manifesto || "",
                slogan: c.nickname ? `"${c.nickname}"` : "",
                votes: c.voteCount || c.vote_count || 0,
              })),
          }));
          setLivePosts(mapped);
        }
      } catch (err) {
        console.warn("Failed to load live posts:", err);
      }
    }
    loadPostsAndCandidates();
  }, [instSlug, currentOrg.dept]);

  const displayPosts = livePosts.length > 0 ? livePosts : election.posts;

  useEffect(() => {
    async function loadInst() {
      const inst = await getInstitutionBySlug(instSlug);
      setInstitution(inst);
      setRegDept(currentOrg.dept);
      try {
        const savedLogo = localStorage.getItem(`studelect_org_logo_${instSlug}`);
        if (savedLogo) setOrgLogoUrl(savedLogo);
        const savedStatus = localStorage.getItem(`studelect_election_status_${instSlug}`);
        if (savedStatus) setElectionStatus(savedStatus);
        const savedVisibility = localStorage.getItem(`studelect_results_visibility_${instSlug}`);
        if (savedVisibility) setResultsVisibility(savedVisibility);
      } catch (_) {}
    }
    loadInst();
  }, [instSlug, orgSlug, currentOrg.dept]);

  // ── Sync Live Election Status & Visibility in Real-Time ──────────────────
  useEffect(() => {
    let isMounted = true;
    async function syncRules() {
      try {
        const rules = await getElectionRulesAction(
          election.id || `elec-${instSlug}-${orgSlug}-2026`,
          instSlug,
          orgSlug
        );
        if (isMounted && rules) {
          if (rules.status) setElectionStatus(rules.status);
          if (rules.resultsVisibility) setResultsVisibility(rules.resultsVisibility);
          setIsPaymentHalted(!!rules.isPaymentHalted);
        }
      } catch (_) {}
    }
    syncRules();
    // Eco-friendly polling: 6s heartbeat when active, paused when tab is hidden to conserve database tier
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      syncRules();
    }, 6000);

    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        syncRules();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Instant local sync if admin is testing in another tab of same browser
    const onStorage = (e: StorageEvent) => {
      if (e.key === `studelect_election_status_${instSlug}` && e.newValue) {
        setElectionStatus(e.newValue);
      }
      if (e.key === `studelect_results_visibility_${instSlug}` && e.newValue) {
        setResultsVisibility(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [election.id, instSlug, orgSlug]);

  // ── Session Persistence (Prevent logout on page reload) ─────────────────────
  const sessionKey = `studelect_voter_session_${instSlug}_${orgSlug}`;

  useEffect(() => {
    try {
      const savedSession = sessionStorage.getItem(sessionKey);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed.student && parsed.blindToken) {
          setAuthenticatedStudent(parsed.student);
          setBlindToken(parsed.blindToken);
          if (parsed.voteStep) setVoteStep(parsed.voteStep);
          if (parsed.selectedCandidates) setSelectedCandidates(parsed.selectedCandidates);
          if (parsed.receiptCode) setReceiptCode(parsed.receiptCode);
          if (parsed.castTimestamp) setCastTimestamp(parsed.castTimestamp);
        }
      }
    } catch (_) {}
  }, [sessionKey]);

  // Sync active voter state to sessionStorage
  useEffect(() => {
    try {
      if (authenticatedStudent && blindToken) {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            student: authenticatedStudent,
            blindToken,
            voteStep,
            selectedCandidates,
            receiptCode,
            castTimestamp,
          })
        );
      }
    } catch (_) {}
  }, [
    sessionKey,
    authenticatedStudent,
    blindToken,
    voteStep,
    selectedCandidates,
    receiptCode,
    castTimestamp,
  ]);

  const handleVoterLogout = () => {
    try {
      sessionStorage.removeItem(sessionKey);
    } catch (_) {}
    setAuthenticatedStudent(null);
    setBlindToken(null);
    setVoteStep("LOGIN");
    setSelectedCandidates({});
    setReceiptCode(null);
    setCastTimestamp(null);
    setMatricInput("");
    setPinInput("");
  };

  // Accreditation & Login
  const handleAccreditation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoading(true);

    const res = await accreditVoterAction({
      electionId: election.id,
      matricNo: matricInput.trim(),
      pin: pinInput.trim(),
      authMode: "PIN_SLIP",
    });

    setIsLoading(false);

    if (!res.success) {
      setAuthError(res.message || "Invalid credentials or screening failed.");
      return;
    }

    const studentData = {
      matricNo: res.student!.matricNo,
      normalizedMatric: res.student!.matricNo.replace(/[^a-zA-Z0-9]/g, "").toUpperCase(),
      fullName: res.student!.fullName,
      faculty: "Faculty of Science",
      department: res.student!.department,
      level: res.student!.level,
      programType: "FULL_TIME" as const,
      isRegisteredSession: true,
      duesPaid: true,
      disciplinaryStatus: "GOOD_STANDING" as const,
      hallOfResidence: "On-Campus",
      portalPin: pinInput,
      email: "",
    };

    setAuthenticatedStudent(studentData);

    if (res.alreadyVoted) {
      setReceiptCode(res.receiptHash || "");
      setCastTimestamp(Date.now());
      setVoteStep("RECEIPT");
      setActiveTab("RESULTS"); // Direct them straight to live results
      try {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            student: studentData,
            blindToken: null,
            voteStep: "RECEIPT",
            selectedCandidates: {},
            receiptCode: res.receiptHash || "",
            castTimestamp: Date.now(),
            alreadyVoted: true,
          })
        );
      } catch (_) {}
      return;
    }

    setBlindToken(res.ballotToken);
    setVoteStep("BALLOT");

    try {
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          student: studentData,
          blindToken: res.ballotToken,
          voteStep: "BALLOT",
          selectedCandidates: {},
          receiptCode: null,
          castTimestamp: null,
        })
      );
    } catch (_) {}
  };

  // Select Candidate
  const handleSelectCandidate = (postId: string, candidateId: string) => {
    if (electionStatus !== "LIVE") return;
    setSelectedCandidates((prev) => ({
      ...prev,
      [postId]: candidateId,
    }));
  };

  // Cast Ballot
  const handleCastBallot = async () => {
    setIsLoading(true);
    setAuthError(null);

    const tokenToUse = blindToken || {
      tokenId: `anon-${Date.now()}`,
      electionId: `elec-${instSlug}-2026`,
      expiresAt: Date.now() + 3600000,
      signature: "direct-token",
    };

    const res = await castBallotAction({
      ballotToken: tokenToUse,
      matricNo: authenticatedStudent?.matricNo,
      selections: selectedCandidates,
      votes: Object.entries(selectedCandidates).map(([postId, candidateId]) => ({
        postId,
        candidateId,
      })),
      voterLevel: authenticatedStudent?.level || 300,
    });

    setIsLoading(false);

    if (res.success && res.receipt) {
      setReceiptCode(res.receipt.receiptCode);
      setCastTimestamp(res.receipt.timestamp);
      setVoteStep("RECEIPT");

      try {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            student: authenticatedStudent,
            blindToken: tokenToUse,
            voteStep: "RECEIPT",
            selectedCandidates,
            receiptCode: res.receipt.receiptCode,
            castTimestamp: res.receipt.timestamp,
          })
        );
      } catch (_) {}
    } else {
      setAuthError(res.message || "Failed to record ballot.");
    }
  };

  // Student Self-Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);

    const res = await registerStudentAccountAction({
      institutionSlug: instSlug,
      orgSlug: orgSlug,
      matricNo: regMatric.trim(),
      fullName: regFullName.trim(),
      department: regDept,
      level: regLevel,
      email: regEmail.trim() || undefined,
      phoneNumber: regPhone.trim() || undefined,
    });

    setRegLoading(false);

    if (res.success && res.portalPin) {
      setRegSuccessPin(res.portalPin);
      setMatricInput(regMatric.trim());
      setPinInput(res.portalPin);
    } else {
      setRegError(res.message || "Registration failed.");
    }
  };


  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Association Header */}
      <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={orgLogoUrl || `/logos/${instSlug}.svg`}
            alt={currentOrg.name || "Campus Logo"}
            className="w-14 h-14 object-contain flex-shrink-0 rounded-xl bg-zinc-50 border border-zinc-100 p-1"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-900 text-white uppercase">
                {(orgSlug || "").toUpperCase()}
              </span>
              <span className="text-xs font-semibold text-zinc-500">
                {institution?.name || `${(instSlug || "").toUpperCase()} Campus`}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 mt-1">
              {currentOrg.name}
            </h1>
            <p className="text-xs text-zinc-500">{currentOrg.title} • {election.academicSession} Session</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 border ${
              electionStatus === "LIVE"
                ? "bg-zinc-900 text-white border-zinc-900"
                : isPaymentHalted
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : electionStatus === "PAUSED"
                ? "bg-amber-50 text-amber-900 border-amber-300"
                : electionStatus === "CONCLUDED"
                ? "bg-zinc-100 text-zinc-900 border-zinc-300"
                : "bg-zinc-100 text-zinc-700 border-zinc-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                electionStatus === "LIVE"
                  ? "bg-emerald-400"
                  : isPaymentHalted
                  ? "bg-amber-500 animate-pulse"
                  : electionStatus === "PAUSED"
                  ? "bg-amber-500"
                  : "bg-zinc-500"
              }`}
            />
            <span>
              {electionStatus === "LIVE"
                ? "Polls Active"
                : isPaymentHalted
                ? "Halted (Unpaid)"
                : electionStatus === "PAUSED"
                ? "Voting Paused"
                : electionStatus === "CONCLUDED"
                ? "Election Concluded"
                : "Setup Phase"}
            </span>
          </span>
        </div>
      </div>

      {/* Main Student Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("VOTE")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "VOTE"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Vote className="w-4 h-4" />
          <span>Cast My Vote</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CANDIDATES")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "CANDIDATES"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Candidates & Manifestos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REGISTER")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "REGISTER"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>New Voter? Get PIN</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RESULTS")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "RESULTS"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Live Results</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: VOTING BOOTH (LOGIN -> BALLOT -> REVIEW -> RECEIPT) */}
      {/* ========================================================================= */}
      {activeTab === "VOTE" && (
        <div className="space-y-6">
          {/* STEP 1: LOGIN WITH MATRIC + PIN */}
          {voteStep === "LOGIN" && (
            <div className="space-y-6 max-w-xl mx-auto">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6 text-xs">
                <div className="text-center space-y-1.5">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-900">
                    <Vote className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg font-bold text-zinc-900">Enter Polling Booth</h2>
                  <p className="text-zinc-500">
                    Provide your institutional matriculation number and {currentOrg.name} voting PIN to unlock your ballot paper.
                  </p>
                </div>

                {isPaymentHalted ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1.5 text-left">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <span>Election Halted: Payment Verification Required</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Polling for <strong>{currentOrg.name}</strong> is currently paused awaiting organization license activation and payment clearance with the Platform Super Administrator. All voter identities, PINs, and candidate slates remain intact. Polling will resume automatically once payment is verified.
                    </p>
                  </div>
                ) : electionStatus === "PAUSED" ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1 text-left">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Clock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <span>Voting is Temporarily Paused</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      The Electoral Commission (ELCOM) has temporarily suspended ballot casting. Your voter credentials and PIN remain valid. Voting will resume shortly.
                    </p>
                  </div>
                ) : null}

                {electionStatus === "CONCLUDED" && (
                  <div className="p-4 rounded-xl bg-zinc-100 border border-zinc-300 text-zinc-900 space-y-2 text-left">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <ShieldCheck className="w-4 h-4 text-zinc-800 flex-shrink-0" />
                      <span>Election Officially Concluded</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      Voting has concluded and polls are officially closed. You can monitor the certified election standings in the Results tab.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("RESULTS")}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-900 text-white font-bold text-xs hover:bg-zinc-800 transition inline-flex items-center gap-1.5"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>View Final Standings</span>
                    </button>
                  </div>
                )}

                {(electionStatus === "DRAFT" || electionStatus === "ACCREDITATION_OPEN") && (
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-800 space-y-1 text-left">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Clock className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                      <span>Polls Not Open Yet</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      Electoral Commission is currently preparing the register. You can register and retrieve your voter PIN ahead of poll opening.
                    </p>
                  </div>
                )}

                {authError && (
                  <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleAccreditation} className="space-y-4">
                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                      Matriculation Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 21/52HA045 or 2021001"
                      value={matricInput}
                      onChange={(e) => setMatricInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono text-sm uppercase"
                      required
                      disabled={electionStatus !== "LIVE"}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold uppercase text-zinc-700 font-mono text-[11px]">
                        Portal PIN
                      </label>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Issued by ELCOM / on registration
                      </span>
                    </div>
                    <input
                      type="password"
                      placeholder="e.g. NESA-8842 or 4492"
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono text-sm tracking-widest uppercase"
                      required
                      disabled={electionStatus !== "LIVE"}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !matricInput || !pinInput || electionStatus !== "LIVE"}
                    className="w-full py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      {isLoading
                        ? "Verifying Accreditation..."
                        : electionStatus === "PAUSED"
                        ? "Voting Paused by ELCOM"
                        : electionStatus === "CONCLUDED"
                        ? "Polls Concluded & Closed"
                        : electionStatus === "DRAFT"
                        ? "Polls Not Open Yet"
                        : "Unlock My Ballot & Vote"}
                    </span>
                  </button>
                </form>

                <div className="text-center pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setActiveTab("REGISTER")}
                    className="text-xs text-zinc-600 hover:text-zinc-900 font-semibold underline"
                  >
                    Don't have a PIN? Click here to activate your student voter profile →
                  </button>
                </div>
              </div>

              {/* Cleared Candidates Preview Under Login Form */}
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                      OFFICIAL BALLOT PREVIEW
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900">
                      Candidates Contesting in {currentOrg.name}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 font-mono text-[10px] font-bold">
                    {displayPosts.reduce((acc, p) => acc + p.candidates.length, 0)} Cleared Candidates
                  </span>
                </div>

                <div className="space-y-4">
                  {displayPosts.map((post) => (
                    <div key={post.id} className="space-y-2">
                      <h4 className="font-bold text-zinc-800 text-xs border-l-2 border-zinc-900 pl-2">
                        {post.title}
                      </h4>
                      {post.candidates.length === 0 ? (
                        <p className="text-[11px] text-zinc-400 italic pl-2.5">
                          No cleared candidates for this office yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                          {post.candidates.map((cand) => (
                            <div
                              key={cand.id}
                              className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 flex items-start gap-2.5"
                            >
                              <img
                                src={cand.photoUrl}
                                alt={cand.fullName}
                                className="w-9 h-9 rounded-md object-cover border flex-shrink-0 bg-zinc-100"
                              />
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <p className="font-bold text-zinc-900 text-xs truncate">
                                  {cand.fullName}
                                </p>
                                {cand.nickname && (
                                  <p className="text-[10px] text-zinc-500 font-medium truncate">
                                    "{cand.nickname}"
                                  </p>
                                )}
                                {cand.manifesto && (
                                  <p className="text-[10px] text-zinc-500 line-clamp-1 italic">
                                    "{cand.manifesto}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ALREADY VOTED NOTIFICATION */}
          {voteStep === "BALLOT" && authenticatedStudent && receiptCode && (
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6 max-w-xl mx-auto text-xs text-center">
              <div className="w-14 h-14 rounded-full bg-zinc-900 text-white mx-auto flex items-center justify-center">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-zinc-900">Official Ballot Already Cast & Secured</h2>
                <p className="text-zinc-500 text-xs max-w-md mx-auto">
                  Hello, <strong>{authenticatedStudent.fullName}</strong>. You have already cast your official vote for the <strong>{currentOrg.name}</strong> election. Each student identity is cryptographically restricted to one ballot.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-left space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500 font-medium">Your Official Receipt Code:</span>
                  <span className="font-mono font-bold text-zinc-900">{receiptCode}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500 font-medium">Cryptographic Status:</span>
                  <span className="text-emerald-700 font-bold">100% Chained & Verified</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("RESULTS")}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View Live Election Standings</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVoteStep("RECEIPT")}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-800 font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-zinc-500" />
                  <span>View Full Ballot Receipt</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ACTIVE BALLOT PAPER */}
          {voteStep === "BALLOT" && authenticatedStudent && !receiptCode && (
            <div className="space-y-6">
              {/* Voter Identity & Clearance Header */}
              <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-900" />
                    <span className="font-bold text-zinc-900">{authenticatedStudent.fullName}</span>
                    <span className="font-mono text-zinc-500">({authenticatedStudent.matricNo})</span>
                  </div>
                  <p className="text-zinc-500 text-[11px] mt-0.5">
                    {authenticatedStudent.department} • {authenticatedStudent.level}L
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 flex items-center gap-1">
                      <Check className="w-3 h-3 text-zinc-700" />
                      <span>Dues Cleared</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 flex items-center gap-1">
                      <Check className="w-3 h-3 text-zinc-700" />
                      <span>SDC Standing</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleVoterLogout}
                    className="px-2.5 py-1 rounded-md border border-zinc-300 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 text-[10px] font-bold transition"
                    title="Exit voting booth / Log out"
                  >
                    Log Out
                  </button>
                </div>
              </div>

              {electionStatus === "PAUSED" && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1 text-left">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Clock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <span>Voting is Temporarily Paused by ELCOM</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Candidate selections and ballot submission are locked while polls are paused. As soon as the Electoral Commission resumes voting, your ballot will unlock instantly.
                  </p>
                </div>
              )}

              {electionStatus === "CONCLUDED" && (
                <div className="p-4 rounded-xl bg-zinc-100 border border-zinc-300 text-zinc-900 space-y-1 text-left">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-zinc-800 flex-shrink-0" />
                    <span>Election Concluded</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Voting has officially closed. You can monitor certified final standings in the Results tab.
                  </p>
                </div>
              )}

              {/* Contested Offices */}
              <div className="space-y-6">
                {displayPosts.length === 0 ? (
                  <div className="p-8 rounded-xl bg-white border border-zinc-200 text-center space-y-2">
                    <User className="w-8 h-8 text-zinc-400 mx-auto" />
                    <h3 className="font-bold text-zinc-900 text-sm">No Contested Offices Found</h3>
                    <p className="text-xs text-zinc-500">
                      The Electoral Commission has not published offices for this election yet.
                    </p>
                  </div>
                ) : (
                  displayPosts.map((post, postIndex) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden"
                    >
                      <div className="bg-zinc-50 px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-mono">
                            Office {postIndex + 1} of {displayPosts.length}
                          </span>
                          <h2 className="text-base font-bold text-zinc-900">{post.title}</h2>
                        </div>
                        <span className="text-xs text-zinc-500 font-medium">
                          {selectedCandidates[post.id] ? "Selection Made" : "Select 1 Candidate"}
                        </span>
                      </div>

                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {post.candidates.length === 0 ? (
                          <div className="p-6 text-center text-xs text-zinc-500 col-span-full border border-dashed border-zinc-200 rounded-lg bg-zinc-50">
                            <p className="font-semibold text-zinc-700">No Cleared Candidates for this Office</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">Nominations and screening are pending.</p>
                          </div>
                        ) : (
                          post.candidates.map((candidate) => {
                            const isSelected = selectedCandidates[post.id] === candidate.id;
                            return (
                              <button
                                key={candidate.id}
                                type="button"
                                disabled={electionStatus !== "LIVE"}
                                onClick={() => handleSelectCandidate(post.id, candidate.id)}
                                className={`p-4 rounded-lg border text-left transition flex items-start gap-3 relative ${
                                  isSelected
                                    ? "border-zinc-900 bg-zinc-50/80 ring-1 ring-zinc-900"
                                    : electionStatus !== "LIVE"
                                    ? "border-zinc-200 bg-zinc-50 opacity-60 cursor-not-allowed"
                                    : "border-zinc-200 hover:border-zinc-400 bg-white cursor-pointer"
                                }`}
                              >
                                <img
                                  src={candidate.photoUrl}
                                  alt={candidate.fullName}
                                  className="w-12 h-12 rounded-md object-cover border flex-shrink-0 bg-zinc-100"
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

                                  {candidate.matricNo && (
                                    <p className="font-mono text-[10px] text-zinc-400">
                                      Matric: {candidate.matricNo}
                                    </p>
                                  )}

                                  {candidate.manifesto && (
                                    <p className="text-[11px] text-zinc-500 line-clamp-2 pt-0.5 border-t border-zinc-100 mt-1">
                                      "{candidate.manifesto}"
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setVoteStep("LOGIN")}
                  className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => setVoteStep("REVIEW")}
                  disabled={electionStatus !== "LIVE"}
                  className="px-6 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs border border-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>
                    {isPaymentHalted
                      ? "Voting Halted (Unpaid)"
                      : electionStatus === "PAUSED"
                      ? "Voting Paused"
                      : electionStatus === "CONCLUDED"
                      ? "Polls Closed"
                      : "Review Ballot & Proceed"}
                  </span>
                  {electionStatus === "LIVE" && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW BALLOT */}
          {voteStep === "REVIEW" && (
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6 max-w-lg mx-auto text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Final Confirmation
                </span>
                <h2 className="text-lg font-bold text-zinc-900 mt-0.5">Review Your Ballot</h2>
                <p className="text-zinc-500 text-xs mt-1">
                  Verify your selected choices for <strong>{currentOrg.name}</strong> before official submission.
                </p>
              </div>

              {authError && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="divide-y divide-zinc-200 border-y border-zinc-200 py-2 space-y-3">
                {displayPosts.map((post) => {
                  const selectedCandId = selectedCandidates[post.id];
                  const cand = post.candidates.find((c) => c.id === selectedCandId);

                  return (
                    <div key={post.id} className="pt-3 first:pt-0 flex items-center justify-between">
                      <div>
                        <span className="text-zinc-400 uppercase font-semibold text-[10px]">{post.title}</span>
                        <p className="text-sm font-bold text-zinc-900 mt-0.5">
                          {cand ? cand.fullName : "Abstain / No Selection"}
                        </p>
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

              <div className="p-3.5 rounded-lg bg-zinc-100 text-xs text-zinc-700 space-y-1">
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
                  onClick={() => setVoteStep("BALLOT")}
                  className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Modify Choices</span>
                </button>

                <button
                  type="button"
                  onClick={handleCastBallot}
                  disabled={isLoading || electionStatus !== "LIVE"}
                  className="px-6 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Vote className="w-3.5 h-3.5" />
                  <span>
                    {isLoading
                      ? "Recording Official Ballot..."
                      : isPaymentHalted
                      ? "Voting Halted (Payment Pending)"
                      : electionStatus === "PAUSED"
                      ? "Voting Paused by ELCOM"
                      : electionStatus === "CONCLUDED"
                      ? "Polls Concluded & Closed"
                      : "Submit Official Ballot"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: RECEIPT */}
          {voteStep === "RECEIPT" && receiptCode && (
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6 text-center max-w-lg mx-auto text-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-zinc-900">Ballot Successfully Cast!</h2>
                <p className="text-xs text-zinc-500">
                  Your vote for <strong>{currentOrg.name}</strong> has been cryptographically recorded into the immutable audit ledger.
                </p>
              </div>

              <div className="p-5 rounded-lg bg-zinc-50 border border-zinc-200 space-y-4 text-left">
                <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      Cryptographic Receipt Hash:
                    </span>
                    <p className="text-base font-mono font-bold text-zinc-900 break-all">
                      {receiptCode}
                    </p>
                    <p className="text-[10px] text-zinc-400 font-mono">
                      Timestamp: {castTimestamp ? new Date(castTimestamp).toLocaleString("en-NG") : new Date().toLocaleString("en-NG")}
                    </p>
                  </div>

                  <div className="bg-white p-1.5 rounded border shadow-2xs flex-shrink-0">
                    <QRCodeSVG value={receiptCode} size={65} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-zinc-600">
                    Save this hash code to independently verify inclusion in the public audit ledger.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await safeCopyToClipboard(receiptCode);
                      if (ok) {
                        setCopiedReceipt(true);
                        setTimeout(() => setCopiedReceipt(false), 2500);
                      }
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
                <button
                  type="button"
                  onClick={() => setActiveTab("RESULTS")}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View Live Election Standings</span>
                </button>

                <button
                  type="button"
                  onClick={handleVoterLogout}
                  className="px-4 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold transition"
                >
                  Exit Booth
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CANDIDATES & MANIFESTOS SHOWCASE                                   */}
      {/* ========================================================================= */}
      {activeTab === "CANDIDATES" && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 pb-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                OFFICIAL CANDIDATE PROFILES
              </span>
              <h2 className="text-lg font-bold text-zinc-900 mt-0.5">
                {currentOrg.name} — Contesting Candidates
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("VOTE");
                setVoteStep("LOGIN");
              }}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs border border-zinc-900 self-start sm:self-auto"
            >
              <Vote className="w-3.5 h-3.5" />
              <span>Proceed to Cast Vote</span>
            </button>
          </div>

          <div className="space-y-8">
            {displayPosts.map((post, pIdx) => (
              <div key={post.id} className="space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-900 text-white text-[11px] font-bold flex items-center justify-center font-mono">
                    {pIdx + 1}
                  </span>
                  <h3 className="font-bold text-zinc-900 text-base">{post.title}</h3>
                  {post.description && (
                    <span className="text-xs text-zinc-500 font-normal">
                      • {post.description}
                    </span>
                  )}
                </div>

                {post.candidates.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                    <User className="w-7 h-7 text-zinc-400 mx-auto mb-1.5" />
                    <p className="font-semibold text-zinc-700 text-sm">No Cleared Candidates Yet</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Nominations for {post.title} are currently being screened by ELCOM.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {post.candidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="p-5 rounded-xl border border-zinc-200 bg-white shadow-sm flex flex-col justify-between space-y-4"
                      >
                        <div className="flex items-start gap-3.5">
                          <img
                            src={cand.photoUrl}
                            alt={cand.fullName}
                            className="w-16 h-16 rounded-lg object-cover border border-zinc-200 flex-shrink-0 bg-zinc-100 shadow-2xs"
                          />
                          <div className="space-y-1 flex-1 min-w-0 text-xs">
                            <h4 className="font-bold text-zinc-900 text-sm">{cand.fullName}</h4>
                            {cand.nickname && (
                              <p className="text-[11px] font-semibold text-zinc-600 font-mono">
                                "{cand.nickname}"
                              </p>
                            )}
                            {cand.matricNo && (
                              <p className="font-mono text-[10px] text-zinc-400">
                                Matric: {cand.matricNo}
                              </p>
                            )}
                            <span className="inline-block px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[10px] font-bold font-mono">
                              CLEARED FOR BALLOT
                            </span>
                          </div>
                        </div>

                        {cand.manifesto ? (
                          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs text-zinc-600 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                              Manifesto & Agenda
                            </span>
                            <p className="italic leading-relaxed">"{cand.manifesto}"</p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-400 italic">
                            No manifesto submitted.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FIRST TIME VOTER REGISTRATION / ACTIVATE PIN                      */}
      {/* ========================================================================= */}
      {activeTab === "REGISTER" && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4 text-xs">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Activate Student Voting Profile
              </h2>
              <p className="text-zinc-500 text-xs mt-0.5">
                Register under <strong>{currentOrg.name}</strong> to receive your 8-character voter PIN immediately.
              </p>
            </div>

            {regSuccessPin ? (
              /* ── Full-screen PIN Save Overlay ─────────────────────────────────── */
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

                  {/* Header — dark, clean, no emoji */}
                  <div className="bg-zinc-900 px-6 py-5 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">Voter Accreditation</p>
                        <h2 className="text-sm font-bold leading-tight">Profile Activated</h2>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                      {currentOrg.name}
                    </p>
                  </div>

                  <div className="px-6 py-5 space-y-4">

                    {/* Warning notice — no emoji, clean */}
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-700">
                      <Lock className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-zinc-900">Save this PIN immediately.</strong> It cannot be recovered if lost. Screenshot this screen or copy to a safe place.
                      </span>
                    </div>

                    {/* PIN Display */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest text-center">Your Voter Access PIN</p>
                      <div className="py-4 px-3 rounded-xl bg-zinc-900 font-mono text-2xl font-extrabold text-white tracking-[0.3em] select-all text-center">
                        {regSuccessPin}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                        <span>Matric No.</span>
                        <span className="font-mono font-semibold text-zinc-800">{regMatric}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await safeCopyToClipboard(
                            `${currentOrg.name} — Voter PIN\nMatric: ${regMatric}\nPIN: ${regSuccessPin}\n\nKeep this safe. Needed to vote.`
                          );
                          if (ok) {
                            setCopiedPin(true);
                            setTimeout(() => setCopiedPin(false), 2500);
                          }
                        }}
                        className="py-2.5 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition flex items-center justify-center gap-1.5"
                      >
                        {copiedPin ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-zinc-700" />
                            <span className="font-bold">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy PIN</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `*${currentOrg.name}*\nVoter PIN Slip\n\nMatric: ${regMatric}\nPIN: ${regSuccessPin}\n\nKeep this private. Required to cast your ballot.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Send to WhatsApp</span>
                      </a>
                    </div>

                    {/* PIN recovery note */}
                    <div className="text-[11px] text-zinc-500 border-t border-zinc-100 pt-3">
                      Lost your PIN? Contact your ELCOM administrator or polling officer to reset and re-issue your PIN.
                    </div>

                    {/* Proceed CTA */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("VOTE");
                        setVoteStep("LOGIN");
                      }}
                      className="w-full py-3 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition text-xs flex items-center justify-center gap-2"
                    >
                      <Vote className="w-4 h-4" />
                      I have saved my PIN — Proceed to Vote
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1">
                    Full Name (As on School Portal)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Adebayo Chukwuma Olawale"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1">
                      Matriculation Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 21/52HA045"
                      value={regMatric}
                      onChange={(e) => setRegMatric(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none uppercase font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1">
                      Academic Level
                    </label>
                    <select
                      value={regLevel}
                      onChange={(e) => setRegLevel(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
                    >
                      <option value={100}>100 Level</option>
                      <option value={200}>200 Level</option>
                      <option value={300}>300 Level</option>
                      <option value={400}>400 Level</option>
                      <option value={500}>500 Level</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1">
                      Email Address <span className="text-zinc-400 normal-case font-normal">(optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. adebayo@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1">
                      Phone / WhatsApp <span className="text-zinc-400 normal-case font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 08012345678"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center justify-center gap-2 text-xs shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{regLoading ? "Activating Profile..." : "Activate Profile & Get Voter PIN"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* TAB 4: LIVE RESULTS & STANDINGS                                          */}
      {/* ========================================================================= */}
      {activeTab === "RESULTS" && (
        <div className="space-y-6">
          {resultsVisibility === "SEALED_UNTIL_CLOSE" ? (
            <div className="bg-white p-8 sm:p-12 rounded-2xl border border-zinc-200 shadow-sm text-center max-w-lg mx-auto space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 mx-auto flex items-center justify-center shadow-xs">
                <Lock className="w-8 h-8 text-amber-700" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-200">
                  Results Withheld / Sealed by ELCOM
                </span>
                <h2 className="text-xl font-bold text-zinc-900 mt-2">
                  Election Standings Are Sealed
                </h2>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  The Electoral Commission (ELCOM) has withheld live vote tallies to maintain strict neutrality and avoid bandwagon effects. Official certified results will be published once voting officially concludes.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-6 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Live Election Telemetry
                  </span>
                  <h2 className="text-lg font-bold text-zinc-900 mt-0.5">
                    {currentOrg.name} — Real-Time Standings
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-800 font-mono text-[11px] font-medium">
                  {election.totalBallotsCast} Ballots Verified & Cast
                </span>
              </div>

              <div className="space-y-6">
                {displayPosts.map((post) => {
                  const totalPostVotes = post.candidates.reduce((acc, c) => acc + c.votes, 0) || 1;

                  return (
                    <div key={post.id} className="space-y-3">
                      <h3 className="font-bold text-zinc-900 text-sm border-b border-zinc-100 pb-1.5">
                        {post.title}
                      </h3>

                      <div className="space-y-2.5">
                        {post.candidates.map((cand) => {
                          const percentage = Math.round((cand.votes / totalPostVotes) * 100);
                          return (
                            <div key={cand.id} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-zinc-900">
                                  {cand.fullName} {cand.nickname && `("${cand.nickname}")`}
                                </span>
                                <span className="font-mono text-zinc-600">
                                  {cand.votes} votes ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-zinc-900 h-2 rounded-full transition-all duration-500"
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
      )}
    </div>
  );
}
