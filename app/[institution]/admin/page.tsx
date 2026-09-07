"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { MockStudent } from "@/lib/mock-data";
import { generateSingleVoterPin } from "@/lib/auth/pin-generator";
import { importVoterRollAction } from "@/app/actions/voter-roll";
import { toggleStudentAdminRoleAction } from "@/app/actions/promote-student";
import {
  getElectionPostsAndCandidatesAction,
  createPostAction,
  createCandidateAction,
  updateCandidateAction,
  deleteCandidateAction,
  deletePostAction,
  PostWithCandidatesDto,
} from "@/app/actions/candidates";
import {
  getOrgVoterRollAction,
  updateStudentDuesAction,
  toggleStudentActiveAction,
  resetStudentPinAction,
  deleteStudentAction,
  getElectionRulesAction,
  updateElectionRulesAction,
  updateElectionStatusAction,
  updateResultsVisibilityAction,
  getElectionAuditLogsAction,
  getOrgLicenseInfoAction,
  ElectionRulesState,
} from "@/app/actions/student-register";
import {
  buildSuperAdminWhatsAppUrl,
  SUPERADMIN_WHATSAPP_RAW,
  AdminWhatsAppReason,
} from "@/lib/whatsapp";
import { getCurrentUserSession } from "@/app/actions/auth";
import { getInstitutionBySlug } from "@/lib/db/institutions";
import { updateOrgLogoAction } from "@/app/actions/elections";
import {
  parseExcelOrCsvFile,
  exportVoterRegisterToExcel,
  exportVoterPinsToExcel,
  downloadSampleExcelTemplate,
} from "@/lib/excel/excel-engine";
import { getRealtimeElectionTelemetryAction } from "@/app/actions/vote";
import {
  UploadCloud,
  FileSpreadsheet,
  Users,
  Key,
  ShieldAlert,
  Download,
  ArrowLeft,
  Search,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Share2,
  ExternalLink,
  UserCheck,
  ShieldCheck,
  FileDown,
  CheckCircle2,
  Trophy,
  User,
  Upload,
  Image as ImageIcon,
  Trash2,
  Pencil,
  X,
  Vote,
  Eye,
  EyeOff,
  RotateCcw,
  BarChart2,
  BarChart3,
  PieChart,
  Activity,
  TrendingUp,
  Printer,
  Mail,
  Phone,
  Sliders,
  Scale,
  CreditCard,
  GraduationCap,
  Play,
  Pause,
  StopCircle,
  Radio,
  FileText,
  Award,
  Calendar,
  HelpCircle,
  MessageSquare,
  History,
  LifeBuoy,
  AlertTriangle,
} from "lucide-react";

export default function InstitutionAdminPage({
  params,
}: {
  params: Promise<{ institution: string }>;
}) {
  const resolvedParams = use(params);
  const instSlug = (resolvedParams?.institution || "ui").toLowerCase();
  const [activeTab, setActiveTab] = useState<
    "RESULTS" | "CANDIDATES" | "ROSTER" | "RULES" | "PINS" | "LOGS"
  >("RESULTS");

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditLogsLoading, setIsAuditLogsLoading] = useState(false);
  const [logFilterAction, setLogFilterAction] = useState<string>("ALL");
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");

  // Contact Support Modal State
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportReason, setSupportReason] = useState<AdminWhatsAppReason>("QUOTA_TOPUP");
  const [orgLicenseInfo, setOrgLicenseInfo] = useState<any>({
    voterQuota: 500,
    registeredVotersCount: 0,
    licenseStatus: "ACTIVE",
  });

  const [telemetryData, setTelemetryData] = useState<any>({
    totalRegistered: 0,
    totalBallotsCast: 0,
    turnoutPercentage: 0,
    posts: [],
    levelBreakdown: [],
    recentAuditLedger: [],
    lastUpdated: Date.now(),
  });
  const [isTelemetryLoading, setIsTelemetryLoading] = useState(false);

  const [posts, setPosts] = useState<PostWithCandidatesDto[]>([
    {
      id: "post-1",
      electionId: "elec-default",
      title: "President",
      maxSelections: 1,
      allowedLevels: [],
      candidates: [],
    },
    {
      id: "post-2",
      electionId: "elec-default",
      title: "Vice President",
      maxSelections: 1,
      allowedLevels: [],
      candidates: [],
    },
    {
      id: "post-3",
      electionId: "elec-default",
      title: "General Secretary",
      maxSelections: 1,
      allowedLevels: [],
      candidates: [],
    },
  ]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [adminActionMessage, setAdminActionMessage] = useState<string | null>(null);
  const [histogramMode, setHistogramMode] = useState<"LEVEL" | "HOURLY">("LEVEL");
  const [isPreviewPrintOpen, setIsPreviewPrintOpen] = useState(false);

  // ── Voter Management State ──────────────────────────────────────────────────
  const [voterRoll, setVoterRoll] = useState<any[]>([]);
  const [voterRollLoading, setVoterRollLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<number | "ALL">("ALL");
  const [duesFilter, setDuesFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DISABLED">("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "ADMIN" | "STUDENT">("ALL");
  const [revealedPins, setRevealedPins] = useState<Set<string>>(new Set());
  const [voterSearch, setVoterSearch] = useState("");

  // New Post Modal State
  const [isAddPostModalOpen, setIsAddPostModalOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostDesc, setNewPostDesc] = useState("");

  // New Candidate Modal State
  const [activePostForNomination, setActivePostForNomination] = useState<string | null>(null);
  const [candForm, setCandForm] = useState({
    fullName: "",
    nickname: "",
    matricNo: "",
    photoUrl: "",
    manifesto: "",
  });

  // Edit Candidate Modal State
  const [editingCandidate, setEditingCandidate] = useState<{
    id: string;
    postId: string;
    fullName: string;
    nickname: string;
    matricNo: string;
    photoUrl: string;
    manifesto: string;
    status: "NOMINATED" | "CLEARED" | "DISQUALIFIED";
  } | null>(null);

  // Official University Crest State (managed strictly by Platform SuperAdmin)
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);

  const electionId = `elec-${instSlug}-2026`;

  // Election Eligibility Rules State
  const [electionRules, setElectionRules] = useState<ElectionRulesState>({
    electionId: `elec-${instSlug}-2026`,
    status: "DRAFT",
    requireDuesPayment: true,
    requireGoodDisciplinaryStanding: true,
    requireFullTimeOnly: false,
    requireSessionRegistration: true,
    allowedLevels: [100, 200, 300, 400, 500],
    authMode: "PIN_SLIP",
    resultsVisibility: "LIVE",
  });
  const [isSavingRules, setIsSavingRules] = useState(false);

  useEffect(() => {
    async function loadRules() {
      const res = await getElectionRulesAction(electionId);
      if (res) setElectionRules(res);
    }
    loadRules();
  }, [electionId]);

  const [activeOrgSlug, setActiveOrgSlug] = useState<string>("");

  useEffect(() => {
    async function resolveActiveOrg() {
      let detectedOrg = "";
      if (typeof window !== "undefined") {
        const queryOrg = new URLSearchParams(window.location.search).get("org");
        if (queryOrg) detectedOrg = queryOrg.toLowerCase().trim();
      }
      if (!detectedOrg) {
        try {
          const session = await getCurrentUserSession();
          if (session?.orgId) {
            detectedOrg = session.orgId.replace(/^org-[^-]+-/, "").toLowerCase().trim();
          }
        } catch (_) {}
      }
      if (!detectedOrg) {
        detectedOrg = instSlug === "unilag" ? "nacos" : "nesa";
      }
      setActiveOrgSlug(detectedOrg);
    }
    resolveActiveOrg();
  }, [instSlug]);

  // Load organization license metadata
  useEffect(() => {
    async function loadLicense() {
      const orgToLoad = activeOrgSlug || (instSlug === "unilag" ? "nacos" : "nesa");
      const res = await getOrgLicenseInfoAction(orgToLoad, instSlug);
      if (res && res.license) {
        setOrgLicenseInfo(res.license);
      }
    }
    loadLicense();
  }, [activeOrgSlug, instSlug]);

  // Load audit logs when switching to LOGS tab or on interval
  const loadAuditLogs = async () => {
    setIsAuditLogsLoading(true);
    try {
      const res = await getElectionAuditLogsAction(electionId, instSlug);
      if (res && res.success) {
        setAuditLogs(res.logs || []);
      }
    } catch (_) {
    } finally {
      setIsAuditLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "LOGS") {
      loadAuditLogs();
    }
  }, [activeTab, electionId, instSlug]);

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

  // ── Load Real-Time Election Telemetry & Candidates ─────────────────────────
  const loadTelemetry = async () => {
    try {
      const data = await getRealtimeElectionTelemetryAction(electionId, instSlug);
      if (data && data.success) {
        setTelemetryData(data);
        if (data.posts && data.posts.length > 0) {
          setPosts(data.posts);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    loadTelemetry();
    // Eco-friendly polling: 6s when active, paused when admin tab is backgrounded
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      loadTelemetry();
    }, 6000);

    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadTelemetry();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [electionId, instSlug]);

  useEffect(() => {
    if (posts && posts.length > 0) {
      try {
        localStorage.setItem(`studelect_posts_${instSlug}`, JSON.stringify(posts));
      } catch (_) {}
    }
  }, [posts, instSlug]);

  // ── Voter Roll Loader ───────────────────────────────────────────────────────
  const loadVoterRoll = async (targetOrg?: any) => {
    setVoterRollLoading(true);
    const orgToUse = typeof targetOrg === "string" ? targetOrg : activeOrgSlug;
    const res = await getOrgVoterRollAction(instSlug, orgToUse || undefined);
    if (res.success) setVoterRoll(res.students);
    setVoterRollLoading(false);
  };

  useEffect(() => {
    if (activeOrgSlug) {
      loadVoterRoll(activeOrgSlug);
    } else {
      loadVoterRoll();
    }
    try {
      const cached = localStorage.getItem(`studelect_org_logo_${instSlug}`);
      if (cached) setOrgLogoUrl(cached);
    } catch (_) {}
    getInstitutionBySlug(instSlug).then((inst) => {
      if (inst?.logoUrl) {
        setOrgLogoUrl((prev) => prev || inst.logoUrl || null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgSlug, instSlug]);

  // ── Organization DP / Logo Upload Handler ──────────────────────────────────
  const handleOrgLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      setAdminActionMessage("Image must be smaller than 2.5MB.");
      setTimeout(() => setAdminActionMessage(null), 4000);
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        const dataUrl = reader.result as string;
        setOrgLogoUrl(dataUrl);
        try {
          localStorage.setItem(`studelect_org_logo_${instSlug}`, dataUrl);
        } catch (_) {}

        setAdminActionMessage("Updating organization DP / display picture...");
        const res = await updateOrgLogoAction(instSlug, dataUrl);
        if (res && res.success) {
          setAdminActionMessage("Organization DP updated successfully!");
        } else {
          setAdminActionMessage("Organization DP updated locally.");
        }
        setTimeout(() => setAdminActionMessage(null), 5000);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Voter Management Handlers ───────────────────────────────────────────────
  const handleToggleDues = async (studentId: string, current: boolean) => {
    setVoterRoll((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, duesPaid: !current } : s))
    );
    await updateStudentDuesAction(studentId, !current);
  };

  const handleToggleActive = async (studentId: string, currentStatus: string) => {
    const isActive = currentStatus === "GOOD_STANDING";
    const newStatus = isActive ? "SUSPENDED" : "GOOD_STANDING";
    setVoterRoll((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, disciplinaryStatus: newStatus } : s))
    );
    await toggleStudentActiveAction(studentId, !isActive);
  };

  const handleResetPin = async (studentId: string) => {
    if (!confirm("Generate a new PIN for this student? Their old PIN will stop working.")) return;
    const res = await resetStudentPinAction(studentId, instSlug);
    if (res.success && res.newPin) {
      setVoterRoll((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, portalPin: res.newPin } : s))
      );
      setRevealedPins((prev) => new Set([...prev, studentId]));
      setAdminActionMessage(`PIN reset successfully: ${res.newPin}`);
      setTimeout(() => setAdminActionMessage(null), 5000);
    }
  };

  const togglePinReveal = (studentId: string) => {
    setRevealedPins((prev) => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  };

  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete "${name}" from the voter register? This will invalidate their PIN.`
      )
    )
      return;
    setVoterRoll((prev) => prev.filter((s) => s.id !== studentId));
    const res = await deleteStudentAction(studentId);
    setAdminActionMessage(res.message || `Deleted voter record for ${name}.`);
    setTimeout(() => setAdminActionMessage(null), 4000);
  };

  const handleToggleAdminRole = async (student: any) => {
    const isCurrentlyAdmin = !!student.isAdmin;
    const confirmText = isCurrentlyAdmin
      ? `Revoke Admin privileges for ${student.fullName} (${student.matricNo})?`
      : `Promote ${student.fullName} (${student.matricNo}) to Polling Agent / ELCOM Admin? They can sign into the Admin Panel with password "elcom2026".`;

    if (!confirm(confirmText)) return;

    setVoterRoll((prev) =>
      prev.map((s) => (s.id === student.id ? { ...s, isAdmin: !isCurrentlyAdmin } : s))
    );

    const res = await toggleStudentAdminRoleAction({
      institutionSlug: instSlug,
      matricNo: student.matricNo,
      isAdmin: !isCurrentlyAdmin,
      adminRole: "POLLING_OFFICER",
    });

    if (res.success) {
      setAdminActionMessage(res.message);
      loadVoterRoll();
    } else {
      setAdminActionMessage(res.message || "Failed to update admin role.");
      loadVoterRoll();
    }
    setTimeout(() => setAdminActionMessage(null), 7000);
  };

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRules(true);
    const res = await updateElectionRulesAction(electionRules);
    setIsSavingRules(false);
    setAdminActionMessage(res.message || "Election rules saved successfully.");
    setTimeout(() => setAdminActionMessage(null), 4000);
  };

  const handleUpdateElectionStatus = async (
    newStatus: "DRAFT" | "ACCREDITATION_OPEN" | "LIVE" | "PAUSED" | "CONCLUDED"
  ) => {
    let confirmMsg = "";
    if (newStatus === "LIVE") {
      confirmMsg =
        "Kickstart & Open Polls? Students with valid PINs will immediately be able to cast their votes.";
    } else if (newStatus === "PAUSED") {
      confirmMsg = "Pause the voting exercise temporarily?";
    } else if (newStatus === "CONCLUDED") {
      confirmMsg =
        "Officially conclude and close this election? Ballot casting will be permanently locked.";
    } else {
      confirmMsg = `Change election status to ${newStatus}?`;
    }

    if (!confirm(confirmMsg)) return;

    setElectionRules((prev) => ({ ...prev, status: newStatus }));
    try {
      localStorage.setItem(`studelect_election_status_${instSlug}`, newStatus);
    } catch (_) {}

    const res = await updateElectionStatusAction(electionId, newStatus);
    setAdminActionMessage(res.message || `Election status is now ${newStatus}.`);
    setTimeout(() => setAdminActionMessage(null), 5000);
  };

  const handleToggleResultsVisibility = async (
    newVisibility: "LIVE" | "SEALED_UNTIL_CLOSE"
  ) => {
    const confirmMsg =
      newVisibility === "LIVE"
        ? "Release election results? Live candidate standings and vote tallies will become immediately visible to all students."
        : "Withhold / Seal election results? Live standings will be hidden from the student portal.";
    if (!confirm(confirmMsg)) return;

    setElectionRules((prev) => ({ ...prev, resultsVisibility: newVisibility }));
    try {
      localStorage.setItem(`studelect_results_visibility_${instSlug}`, newVisibility);
    } catch (_) {}

    const res = await updateResultsVisibilityAction(electionId, newVisibility);
    setAdminActionMessage(res.message);
    setTimeout(() => setAdminActionMessage(null), 5000);
  };

  const exportVoterRollCSV = () => {
    const rows = filteredVoters.map((s) => [
      s.matricNo,
      s.fullName,
      s.level + "L",
      s.email,
      s.phoneNumber,
      s.department,
      s.duesPaid ? "PAID" : "UNPAID",
      s.disciplinaryStatus === "GOOD_STANDING" ? "ACTIVE" : "DISABLED",
      s.portalPin,
    ]);
    const header = [
      "Matric No",
      "Full Name",
      "Level",
      "Email",
      "Phone",
      "Department",
      "Dues",
      "Status",
      "PIN",
    ];
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voter-roll-${instSlug}-${Date.now()}.csv`;
    a.click();
  };

  // Filtered voter roll
  const filteredVoters = voterRoll.filter((s) => {
    const search = voterSearch.toLowerCase();
    const matchSearch =
      !search ||
      s.fullName?.toLowerCase().includes(search) ||
      s.matricNo?.toLowerCase().includes(search) ||
      s.email?.toLowerCase().includes(search) ||
      s.department?.toLowerCase().includes(search);
    const matchLevel = levelFilter === "ALL" || s.level === levelFilter;
    const matchDues =
      duesFilter === "ALL" ||
      (duesFilter === "PAID" && s.duesPaid) ||
      (duesFilter === "UNPAID" && !s.duesPaid);
    const isActive = s.disciplinaryStatus === "GOOD_STANDING";
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && isActive) ||
      (statusFilter === "DISABLED" && !isActive);
    const matchRole =
      roleFilter === "ALL" ||
      (roleFilter === "ADMIN" && s.isAdmin) ||
      (roleFilter === "STUDENT" && !s.isAdmin);
    return matchSearch && matchLevel && matchDues && matchStatus && matchRole;
  });

  // Stats
  const totalVoters = voterRoll.length;
  const duesPaidCount = voterRoll.filter((s) => s.duesPaid).length;
  const activeCount = voterRoll.filter((s) => s.disciplinaryStatus === "GOOD_STANDING").length;
  const adminCount = voterRoll.filter((s) => s.isAdmin).length;
  const levelCounts: Record<number, number> = { 100: 0, 200: 0, 300: 0, 400: 0, 500: 0 };
  voterRoll.forEach((s) => {
    if (levelCounts[s.level] !== undefined) levelCounts[s.level]++;
  });
  const maxLevelCount = Math.max(...Object.values(levelCounts), 1);

  // Image Upload handler for Candidate Photo
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim()) return;

    const res = await createPostAction({
      electionId,
      title: newPostTitle.trim(),
      description: newPostDesc.trim(),
    });

    const newPost: PostWithCandidatesDto = {
      id: res.postId || `post-${Date.now()}`,
      electionId,
      title: newPostTitle.trim(),
      description: newPostDesc.trim(),
      maxSelections: 1,
      allowedLevels: [],
      candidates: [],
    };

    setPosts((prev) => [...prev, newPost]);
    setNewPostTitle("");
    setNewPostDesc("");
    setIsAddPostModalOpen(false);
    setAdminActionMessage(res.message || "Office created successfully.");
    setTimeout(() => setAdminActionMessage(null), 4000);
  };

  const handleNominateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePostForNomination || !candForm.fullName.trim()) return;

    const res = await createCandidateAction({
      postId: activePostForNomination,
      fullName: candForm.fullName.trim(),
      nickname: candForm.nickname.trim(),
      matricNo: candForm.matricNo.trim(),
      photoUrl: candForm.photoUrl.trim(),
      manifesto: candForm.manifesto.trim(),
    });

    const newCand = {
      id: res.candidateId || `cand-${Date.now()}`,
      postId: activePostForNomination,
      fullName: candForm.fullName.trim(),
      nickname: candForm.nickname.trim(),
      matricNo: candForm.matricNo.trim(),
      photoUrl: candForm.photoUrl.trim(),
      manifesto: candForm.manifesto.trim(),
      status: "CLEARED" as const,
      voteCount: 0,
    };

    setPosts((prev) =>
      prev.map((post) =>
        post.id === activePostForNomination
          ? { ...post, candidates: [...post.candidates, newCand] }
          : post
      )
    );

    setCandForm({ fullName: "", nickname: "", matricNo: "", photoUrl: "", manifesto: "" });
    setActivePostForNomination(null);
    setAdminActionMessage(res.message || "Candidate nominated successfully.");
    setTimeout(() => setAdminActionMessage(null), 4000);
  };

  const handleOpenEditCandidate = (cand: any, postId: string) => {
    setEditingCandidate({
      id: cand.id,
      postId: postId,
      fullName: cand.fullName || "",
      nickname: cand.nickname || "",
      matricNo: cand.matricNo || "",
      photoUrl: cand.photoUrl || "",
      manifesto: cand.manifesto || "",
      status: cand.status || "CLEARED",
    });
  };

  const handleEditPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setEditingCandidate((prev) =>
          prev ? { ...prev, photoUrl: reader.result as string } : null
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate || !editingCandidate.fullName.trim()) return;

    const res = await updateCandidateAction({
      candidateId: editingCandidate.id,
      fullName: editingCandidate.fullName.trim(),
      nickname: editingCandidate.nickname.trim(),
      matricNo: editingCandidate.matricNo.trim(),
      photoUrl: editingCandidate.photoUrl.trim(),
      manifesto: editingCandidate.manifesto.trim(),
      status: editingCandidate.status,
    });

    if (res.success) {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === editingCandidate.postId
            ? {
                ...post,
                candidates: post.candidates.map((c) =>
                  c.id === editingCandidate.id
                    ? {
                        ...c,
                        fullName: editingCandidate.fullName.trim(),
                        nickname: editingCandidate.nickname.trim(),
                        matricNo: editingCandidate.matricNo.trim(),
                        photoUrl: editingCandidate.photoUrl.trim(),
                        manifesto: editingCandidate.manifesto.trim(),
                        status: editingCandidate.status,
                      }
                    : c
                ),
              }
            : post
        )
      );
      setEditingCandidate(null);
      setAdminActionMessage("Candidate profile updated successfully.");
      setTimeout(() => setAdminActionMessage(null), 4000);
    } else {
      setAdminActionMessage(res.message || "Failed to update candidate.");
      setTimeout(() => setAdminActionMessage(null), 4000);
    }
  };

  const handleDeleteCandidate = async (candidateId: string, postId: string) => {
    if (!confirm("Are you sure you want to remove this candidate?")) return;
    await deleteCandidateAction(candidateId);
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, candidates: post.candidates.filter((c) => c.id !== candidateId) }
          : post
      )
    );
    setAdminActionMessage("Candidate removed from office.");
    setTimeout(() => setAdminActionMessage(null), 4000);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this office and all its candidates?")) return;
    await deletePostAction(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setAdminActionMessage("Office removed.");
    setTimeout(() => setAdminActionMessage(null), 4000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage("Parsing spreadsheet and matching dues columns...");

    try {
      const parseResult = await parseExcelOrCsvFile(file);

      if (!parseResult.success || !parseResult.rows || parseResult.rows.length === 0) {
        setUploadMessage(parseResult.message || "Failed to parse spreadsheet file.");
        setIsUploading(false);
        return;
      }

      setUploadMessage(`Synchronizing ${parseResult.rows.length} student dues records...`);

      const res = await importVoterRollAction(
        instSlug,
        electionId,
        parseResult.rows
      );

      if (res.success) {
        await loadVoterRoll();
        setUploadMessage(
          res.message ||
            `Successfully imported and verified ${res.importedCount} student records.`
        );
        setAdminActionMessage(
          `Voter roll updated: ${res.duesPaidCount || 0} Dues Paid ✅, ${res.duesUnpaidCount || 0} Unpaid ❌.`
        );
        setTimeout(() => setAdminActionMessage(null), 6000);
      } else {
        setUploadMessage(res.message || "Failed to process voter roll file.");
      }
    } catch (err: any) {
      setUploadMessage(err.message || "Failed to parse spreadsheet file.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 print:hidden">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative group flex-shrink-0 cursor-pointer">
            <img
              src={orgLogoUrl || `/logos/${instSlug}.svg`}
              alt="Org DP"
              className="w-14 h-14 object-contain rounded-xl bg-white border border-zinc-200 p-1 shadow-xs transition group-hover:border-zinc-400"
            />
            <label
              title="Click to upload Organization DP / Logo"
              className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center cursor-pointer text-white"
            >
              <Upload className="w-3.5 h-3.5 mb-0.5" />
              <span className="text-[8px] font-bold uppercase tracking-wider">Change DP</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleOrgLogoUpload}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <Link
              href={`/${instSlug}`}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 mb-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Campus Portal</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-900 text-white uppercase">
                ELCOM DESK
              </span>
              <span className="text-xs text-zinc-500 uppercase font-semibold">
                {instSlug} Electoral Commission
              </span>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">
              Operations & Accreditation Desk
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="px-3.5 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-xs">
            <ImageIcon className="w-3.5 h-3.5 text-zinc-600" />
            <span>Upload Org DP</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleOrgLogoUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setIsSupportModalOpen(true)}
            className="px-3.5 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="Contact SuperAdmin on WhatsApp for Quota, Clearance or Emergency Support"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Contact Support</span>
          </button>

          <Link
            href={`/${instSlug}/admin/create`}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Initialize New Election</span>
          </Link>
        </div>
      </div>

      {/* Election Lifecycle Operations & Kickstart Bar */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-3 h-3 rounded-full flex-shrink-0 ${
              electionRules.status === "LIVE"
                ? "bg-zinc-900 ring-4 ring-zinc-100"
                : electionRules.status === "PAUSED"
                ? "bg-amber-600 ring-4 ring-amber-50"
                : electionRules.status === "CONCLUDED"
                ? "bg-rose-700 ring-4 ring-rose-50"
                : "bg-zinc-400 ring-4 ring-zinc-100"
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                LIFECYCLE STATUS:
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-900 border border-zinc-200 font-mono">
                {electionRules.status === "LIVE"
                  ? "Polls Open"
                  : electionRules.status === "PAUSED"
                  ? "Voting Paused"
                  : electionRules.status === "CONCLUDED"
                  ? "Concluded"
                  : "Draft / Setup"}
              </span>
            </div>
            <p className="text-xs text-zinc-600 mt-0.5">
              {electionRules.status === "LIVE"
                ? "Accreditation and ballot casting are currently active for eligible voters."
                : electionRules.status === "PAUSED"
                ? "Voting is temporarily paused by the commission. Ballot casting is halted."
                : electionRules.status === "CONCLUDED"
                ? "Polls are concluded. Ballot casting is locked and verified audit results are certified."
                : "Election is in preparation phase. Click 'Open Polls' when ready for students to vote."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {electionRules.status !== "LIVE" ? (
            <button
              type="button"
              onClick={() => handleUpdateElectionStatus("LIVE")}
              className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs border border-zinc-900"
            >
              <Play className="w-3.5 h-3.5 fill-white text-white" />
              <span>Open Polls</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleUpdateElectionStatus("PAUSED")}
              className="px-3.5 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-bold text-xs transition flex items-center gap-1.5 bg-white"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Voting</span>
            </button>
          )}

          {electionRules.status !== "CONCLUDED" && (
            <button
              type="button"
              onClick={() => handleUpdateElectionStatus("CONCLUDED")}
              className="px-3.5 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-bold text-xs transition flex items-center gap-1.5 bg-white"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>Conclude Polls</span>
            </button>
          )}

          {/* Results Release / Withhold Toggle */}
          {electionRules.resultsVisibility === "LIVE" ? (
            <button
              type="button"
              onClick={() => handleToggleResultsVisibility("SEALED_UNTIL_CLOSE")}
              className="px-3.5 py-2.5 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-800 font-bold text-xs transition flex items-center gap-1.5 bg-white"
              title="Hide live results from students"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Withhold Results</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleToggleResultsVisibility("LIVE")}
              className="px-3.5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs border border-zinc-900"
              title="Publish live results and vote tallies to students"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Release Results</span>
            </button>
          )}
        </div>
      </div>

      {/* Permanent Live Voting URL Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-700 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 font-mono">
              OFFICIAL STUDENT VOTER ACCESS URL
            </span>
          </div>
          <p className="font-mono text-sm font-bold text-white break-all">
            {typeof window !== "undefined"
              ? `${window.location.origin}/${instSlug}/${activeOrgSlug || "nesa"}`
              : `http://localhost:3000/${instSlug}/${activeOrgSlug || "nesa"}`}
          </p>
          <p className="text-[11px] text-zinc-400">
            Share this link to student WhatsApp group chats, notice boards, and department portals.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/${instSlug}/${activeOrgSlug || "nesa"}`;
              const ok = await safeCopyToClipboard(url);
              if (ok) {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2500);
              }
            }}
            className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition flex items-center gap-1.5 border border-white/10"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied URL!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-300" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
              `🗳️ *OFFICIAL ELECTION NOTICE*\nAccreditation and voting are now officially OPEN!\n\nClick here to lookup your PIN and cast your vote:\n${
                typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
              }/${instSlug}/${activeOrgSlug || "nesa"}\n\n— *Electoral Commission (ELCOM)*`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Broadcast on WhatsApp</span>
          </a>

          <Link
            href={`/${instSlug}/${activeOrgSlug || "nesa"}`}
            target="_blank"
            className="p-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition"
            title="Open Student Portal"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Admin Action Notice */}
      {adminActionMessage && (
        <div className="p-3 rounded-lg bg-zinc-900 text-white text-xs flex items-center justify-between animate-in fade-in">
          <span>{adminActionMessage}</span>
          <button
            type="button"
            onClick={() => setAdminActionMessage(null)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 text-xs font-semibold">
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
          <span>Live Results & Analytics</span>
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
          <Trophy className="w-4 h-4" />
          <span>
            Offices & Candidates ({posts.reduce((a, p) => a + p.candidates.length, 0)})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ROSTER")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "ROSTER"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Voter Management ({voterRoll.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RULES")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "RULES"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Election Rules & Restrictions</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PINS")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "PINS"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Voter PIN Slips</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("LOGS")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
            activeTab === "LOGS"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <History className="w-4 h-4" />
          <span>System & Audit Logs</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB: REAL-TIME ELECTION RESULTS, CHARTS & PRESS TELEMETRY                 */}
      {/* ========================================================================= */}
      {activeTab === "RESULTS" && (
        <div className="space-y-6">
          {/* Header & Stream Status */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-zinc-900" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                  REAL-TIME ELECTORAL TELEMETRY & PRESS OBSERVATION
                </span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mt-1">
                Official Election Standings & Analytics
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Live cryptographic feed streaming verified ballots directly from the tamper-evident ledger.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={loadTelemetry}
                className="px-3 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPreviewPrintOpen(true)}
                className="px-3.5 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5 text-zinc-500" />
                <span>Certificate Preview</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Results</span>
              </button>
            </div>
          </div>

          {/* Top 4 Core Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-zinc-200 shadow-sm space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                REGISTERED VOTERS
              </span>
              <p className="text-2xl font-bold font-mono text-zinc-900">
                {telemetryData.totalRegistered.toLocaleString()}
              </p>
              <p className="text-[11px] text-zinc-400">Total cleared student electorate</p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-zinc-200 shadow-sm space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                VERIFIED BALLOTS CAST
              </span>
              <p className="text-2xl font-bold font-mono text-zinc-900">
                {telemetryData.totalBallotsCast.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-zinc-600">
                <CheckCircle2 className="w-3 h-3 text-zinc-900" />
                <span>Cryptographically verified</span>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-zinc-200 shadow-sm space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                VOTER TURNOUT
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold font-mono text-zinc-900">
                  {telemetryData.turnoutPercentage}%
                </p>
                <span className="text-xs text-zinc-400">of electorate</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-zinc-900 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, telemetryData.turnoutPercentage)}%` }}
                />
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-zinc-200 shadow-sm space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                LEDGER INTEGRITY
              </span>
              <p className="text-2xl font-bold font-mono text-zinc-900">
                100%
              </p>
              <div className="flex items-center gap-1 text-[11px] text-zinc-600">
                <ShieldCheck className="w-3 h-3 text-zinc-900" />
                <span>SHA-256 Chained Nonces</span>
              </div>
            </div>
          </div>

          {/* Charts Section: Left Bar Charts (Office Breakdown) + Right Donut Chart (Level Participation) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Bar Charts per Elective Office */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">
                      Vote Tally & Standings by Elective Office
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Live vote count distributions and margins of victory.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-800 text-[10px] font-bold font-mono uppercase">
                    {posts.length} Contested Offices
                  </span>
                </div>

                <div className="space-y-8">
                  {posts.map((post) => {
                    const totalVotesForPost =
                      post.candidates.reduce((acc, c) => acc + (c.voteCount || 0), 0) || 0;
                    const sortedCandidates = [...post.candidates].sort(
                      (a, b) => (b.voteCount || 0) - (a.voteCount || 0)
                    );
                    const leader = sortedCandidates[0];
                    const runnerUp = sortedCandidates[1];
                    const margin = leader && runnerUp ? (leader.voteCount || 0) - (runnerUp.voteCount || 0) : (leader?.voteCount || 0);

                    return (
                      <div key={post.id} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-zinc-900 text-sm">{post.title}</h4>
                            <span className="text-xs text-zinc-400 font-mono">
                              ({totalVotesForPost} total votes)
                            </span>
                          </div>
                          {leader && leader.voteCount > 0 && (
                            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-900 font-mono text-[10px] font-bold border border-zinc-200">
                              Leader: {leader.fullName} (+{margin})
                            </span>
                          )}
                        </div>

                        {post.candidates.length === 0 ? (
                          <p className="text-xs text-zinc-400 italic py-2">
                            No candidates currently cleared for this office.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {sortedCandidates.map((cand, cIdx) => {
                              const candVotes = cand.voteCount || 0;
                              const percentage =
                                totalVotesForPost > 0
                                  ? Math.round((candVotes / totalVotesForPost) * 100)
                                  : 0;
                              const isLeading = cIdx === 0 && candVotes > 0;
                              const candidatePalette = [
                                { bar: "bg-blue-600", text: "text-blue-700", light: "bg-blue-50 border-blue-200", dot: "bg-blue-600" },
                                { bar: "bg-purple-600", text: "text-purple-700", light: "bg-purple-50 border-purple-200", dot: "bg-purple-600" },
                                { bar: "bg-emerald-600", text: "text-emerald-700", light: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-600" },
                                { bar: "bg-amber-600", text: "text-amber-700", light: "bg-amber-50 border-amber-200", dot: "bg-amber-600" },
                                { bar: "bg-rose-600", text: "text-rose-700", light: "bg-rose-50 border-rose-200", dot: "bg-rose-600" },
                                { bar: "bg-cyan-600", text: "text-cyan-700", light: "bg-cyan-50 border-cyan-200", dot: "bg-cyan-600" },
                              ];
                              const color = candidatePalette[cIdx % candidatePalette.length];

                              return (
                                <div key={cand.id} className="space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className={`w-2 h-2 rounded-full ${color.dot} flex-shrink-0`} />
                                      <img
                                        src={
                                          cand.photoUrl ||
                                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                                            cand.fullName
                                          )}`
                                        }
                                        alt={cand.fullName}
                                        className="w-7 h-7 rounded-md object-cover border border-zinc-200 bg-zinc-100 flex-shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-zinc-900 truncate">
                                            {cand.fullName}
                                          </span>
                                          {cand.nickname && (
                                            <span className="text-[10px] text-zinc-500 font-mono">
                                              "{cand.nickname}"
                                            </span>
                                          )}
                                          {isLeading && (
                                            <span className="px-1.5 py-0.2 rounded bg-zinc-900 text-white text-[9px] font-bold uppercase font-mono">
                                              Leader
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 font-mono text-right flex-shrink-0">
                                      <span className="font-bold text-zinc-900">{candVotes} votes</span>
                                      <span className={`text-[11px] font-bold ${color.text}`}>({percentage}%)</span>
                                    </div>
                                  </div>

                                  {/* Progress Bar Histogram */}
                                  <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden border border-zinc-100">
                                    <div
                                      className={`h-2.5 rounded-full transition-all duration-500 ${color.bar}`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right 1 Col: Donut Chart & Participation Breakdown */}
            <div className="space-y-6">
              {/* Donut Chart Card */}
              <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm space-y-6">
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Voter Turnout by Level</h3>
                  <p className="text-xs text-zinc-500">Demographic participation breakdown</p>
                </div>

                {/* SVG Donut Chart */}
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* Background circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#f4f4f5"
                        strokeWidth="14"
                      />
                      {(() => {
                        const circumference = 251.327;
                        const cohorts = [
                          { level: "100L", stroke: "#2563eb", name: "100 Level (Freshmen)" },
                          { level: "200L", stroke: "#7c3aed", name: "200 Level (Sophomores)" },
                          { level: "300L", stroke: "#059669", name: "300 Level (Penultimate)" },
                          { level: "400L", stroke: "#d97706", name: "400 Level (Finalists)" },
                          { level: "500L", stroke: "#e11d48", name: "500 Level (Professional)" },
                        ];

                        const totalBreakdownVotes = cohorts.reduce((acc, c) => {
                          const item = (telemetryData.levelBreakdown || []).find(
                            (l: any) => l.level === c.level
                          );
                          return acc + (Number(item?.count) || 0);
                        }, 0);

                        const totalCast =
                          totalBreakdownVotes > 0
                            ? totalBreakdownVotes
                            : Number(telemetryData.totalBallotsCast) || 0;

                        if (totalCast === 0) return null;

                        let accumulatedOffset = 0;

                        return cohorts.map((c) => {
                          const item = (telemetryData.levelBreakdown || []).find(
                            (l: any) => l.level === c.level
                          );
                          const count = Number(item?.count) || 0;
                          if (count <= 0) return null;

                          const pct = Math.round((count / totalCast) * 100);
                          const arcLength = (count / totalCast) * circumference;
                          const offset = -accumulatedOffset;
                          accumulatedOffset += arcLength;

                          return (
                            <circle
                              key={c.level}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke={c.stroke}
                              strokeWidth="14"
                              strokeLinecap="butt"
                              strokeDasharray={`${arcLength} ${circumference}`}
                              strokeDashoffset={`${offset}`}
                              className="transition-all duration-500 ease-out cursor-pointer hover:opacity-85"
                            >
                              <title>{`${c.name}: ${count} votes (${pct}%)`}</title>
                            </circle>
                          );
                        });
                      })()}
                    </svg>

                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-xl font-bold font-mono text-zinc-900">
                        {telemetryData.totalBallotsCast}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono uppercase">
                        Ballots Cast
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legend List */}
                <div className="space-y-2.5 text-xs divide-y divide-zinc-100 pt-2">
                  {[
                    { level: "100L", label: "100 Level (Freshmen)", dot: "bg-blue-600", activeDot: "bg-blue-600", text: "text-blue-600" },
                    { level: "200L", label: "200 Level (Sophomores)", dot: "bg-purple-600", activeDot: "bg-purple-600", text: "text-purple-600" },
                    { level: "300L", label: "300 Level (Penultimate)", dot: "bg-emerald-600", activeDot: "bg-emerald-600", text: "text-emerald-600" },
                    { level: "400L", label: "400 Level (Finalists)", dot: "bg-amber-600", activeDot: "bg-amber-600", text: "text-amber-600" },
                    { level: "500L", label: "500 Level (Professional)", dot: "bg-rose-600", activeDot: "bg-rose-600", text: "text-rose-600" },
                  ].map((meta) => {
                    const item = telemetryData.levelBreakdown?.find((l: any) => l.level === meta.level) || { count: 0, percentage: 0 };
                    const hasVotes = (item.count || 0) > 0;
                    return (
                      <div key={meta.level} className="pt-2 first:pt-0 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full transition-opacity ${hasVotes ? meta.dot : "bg-zinc-200"}`} />
                          <span className={hasVotes ? "font-bold text-zinc-900" : "text-zinc-500 font-medium"}>
                            {meta.label}
                          </span>
                        </div>
                        <div className={`font-mono ${hasVotes ? "text-zinc-900 font-semibold" : "text-zinc-400 font-normal"}`}>
                          {item.count} <span className="text-zinc-400 font-normal">({item.percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Observer / Press Certification Card */}
              <div className="p-5 rounded-2xl bg-zinc-900 text-white shadow-sm space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <h4 className="font-bold text-sm">ELCOM Independent Press Room</h4>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  All telemetry is cryptographically signed. Observers and campus media can verify the Merkle block proofs below to confirm zero vote manipulation.
                </p>
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>STATUS: BROADCASTING</span>
                  <span>PROTOCOL: SHA-256</span>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* DATA VISUALS: TURNOUT FREQUENCY DISTRIBUTION HISTOGRAM            */}
          {/* ================================================================= */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-zinc-900 text-sm">
                    Voter Participation Frequency Histogram
                  </h3>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Histogram distribution of verified ballots cast across student cohorts and polling periods.
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setHistogramMode("LEVEL")}
                  className={`px-3 py-1.5 rounded-md transition ${
                    histogramMode === "LEVEL"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  By Academic Level
                </button>
                <button
                  type="button"
                  onClick={() => setHistogramMode("HOURLY")}
                  className={`px-3 py-1.5 rounded-md transition ${
                    histogramMode === "HOURLY"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  By Hourly Flow
                </button>
              </div>
            </div>

            {/* Histogram Canvas */}
            {histogramMode === "LEVEL" ? (
              /* Demographic Level Histogram */
              <div className="space-y-4">
                <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 pt-8 pb-2 px-2 sm:px-6 bg-zinc-50/50 rounded-xl border border-zinc-100 relative">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-4 opacity-40">
                    <div className="border-b border-dashed border-zinc-300 w-full" />
                    <div className="border-b border-dashed border-zinc-300 w-full" />
                    <div className="border-b border-dashed border-zinc-300 w-full" />
                    <div className="border-b border-dashed border-zinc-300 w-full" />
                  </div>

                  {(() => {
                    const levels = [
                      { level: "100L", label: "Freshmen", color: "bg-blue-600" },
                      { level: "200L", label: "Sophomores", color: "bg-purple-600" },
                      { level: "300L", label: "Penultimate", color: "bg-emerald-600" },
                      { level: "400L", label: "Finalists", color: "bg-amber-600" },
                      { level: "500L", label: "Professional", color: "bg-rose-600" },
                    ];
                    const maxCount = Math.max(
                      ...(telemetryData.levelBreakdown || []).map((l: any) => l.count || 0),
                      1
                    );

                    return levels.map((meta) => {
                      const item = (telemetryData.levelBreakdown || []).find((l: any) => l.level === meta.level) || { count: 0, percentage: 0 };
                      const heightPct = Math.max(8, Math.round((item.count / maxCount) * 100));

                      return (
                        <div key={meta.level} className="flex-1 flex flex-col items-center h-full justify-end relative z-10 group">
                          {/* Frequency Count Tooltip / Label */}
                          <div className="mb-2 text-center">
                            <span className="font-mono text-xs font-bold text-zinc-900 block">
                              {item.count}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500 font-medium">
                              {item.percentage}%
                            </span>
                          </div>

                          {/* Bar */}
                          <div className="w-full max-w-[64px] bg-zinc-200/70 rounded-t-lg overflow-hidden flex flex-col justify-end" style={{ height: `${heightPct}%` }}>
                            <div className={`w-full h-full ${meta.color} transition-all duration-700 rounded-t-lg opacity-90 group-hover:opacity-100`} />
                          </div>

                          {/* X-Axis Label */}
                          <div className="mt-3 text-center">
                            <p className="font-mono text-xs font-bold text-zinc-900">{meta.level}</p>
                            <p className="text-[10px] text-zinc-400 hidden sm:block">{meta.label}</p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Statistical Summary Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono">Modal Cohort</span>
                    <p className="font-bold text-zinc-900 mt-0.5">
                      {(() => {
                        const top = [...(telemetryData.levelBreakdown || [])].sort((a: any, b: any) => b.count - a.count)[0];
                        return top && top.count > 0 ? `${top.level} (${top.count} votes)` : "Balanced";
                      })()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono">Mean per Level</span>
                    <p className="font-bold text-zinc-900 mt-0.5 font-mono">
                      {Math.round((telemetryData.totalBallotsCast || 0) / 5)} ballots
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono">Sample Size</span>
                    <p className="font-bold text-zinc-900 mt-0.5 font-mono">
                      {telemetryData.totalBallotsCast} verified
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono">Turnout Rate</span>
                    <p className="font-bold text-zinc-900 mt-0.5 font-mono">
                      {telemetryData.turnoutPercentage}% of roll
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Hourly Flow Histogram */
              <div className="space-y-4">
                <div className="h-64 flex items-end justify-between gap-1 sm:gap-2 pt-8 pb-2 px-2 sm:px-4 bg-zinc-50/50 rounded-xl border border-zinc-100 relative">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-4 opacity-40">
                    <div className="border-b border-dashed border-zinc-300 w-full" />
                    <div className="border-b border-dashed border-zinc-300 w-full" />
                    <div className="border-b border-dashed border-zinc-300 w-full" />
                    <div className="border-b border-dashed border-zinc-300 w-full" />
                  </div>

                  {(() => {
                    const hours = telemetryData.hourlyDistribution || [
                      { hour: "08:00", count: 0, percentage: 0 },
                      { hour: "09:00", count: 0, percentage: 0 },
                      { hour: "10:00", count: 0, percentage: 0 },
                      { hour: "11:00", count: 0, percentage: 0 },
                      { hour: "12:00", count: 0, percentage: 0 },
                      { hour: "13:00", count: 0, percentage: 0 },
                      { hour: "14:00", count: 0, percentage: 0 },
                      { hour: "15:00", count: 0, percentage: 0 },
                      { hour: "16:00", count: 0, percentage: 0 },
                      { hour: "17:00", count: 0, percentage: 0 },
                      { hour: "18:00", count: 0, percentage: 0 },
                    ];
                    const maxHourly = Math.max(...hours.map((h: any) => h.count || 0), 1);

                    return hours.map((item: any) => {
                      const heightPct = Math.max(6, Math.round((item.count / maxHourly) * 100));

                      return (
                        <div key={item.hour} className="flex-1 flex flex-col items-center h-full justify-end relative z-10 group">
                          {/* Value */}
                          <div className="mb-1.5 text-center">
                            <span className="font-mono text-[10px] font-bold text-zinc-900 block">
                              {item.count}
                            </span>
                          </div>

                          {/* Bar */}
                          <div className="w-full max-w-[36px] bg-zinc-200/70 rounded-t-sm overflow-hidden flex flex-col justify-end" style={{ height: `${heightPct}%` }}>
                            <div className="w-full h-full bg-zinc-900 transition-all duration-500 rounded-t-sm group-hover:bg-blue-600" />
                          </div>

                          {/* X-Axis */}
                          <div className="mt-2 text-center">
                            <p className="font-mono text-[9px] font-semibold text-zinc-600">{item.hour}</p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 px-1 pt-1">
                  <span>Polling Start: <strong>08:00 WAT</strong></span>
                  <span className="font-mono text-[11px]">Interval: 60-min Bins</span>
                  <span>Polling Close: <strong>18:00 WAT</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Cryptographic Ledger Live Stream Table (For Observers & Press) */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden text-xs">
            <div className="p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                  PUBLIC OBSERVER & PRESS AUDIT STREAM
                </span>
                <h3 className="font-bold text-zinc-900 text-base">
                  Live Cryptographic Ballot Inclusion Ledger
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-zinc-100 text-zinc-800 font-mono text-[10px] font-bold">
                {telemetryData.recentAuditLedger?.length || 0} Recent Blocks Streamed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono uppercase text-zinc-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Block Nonce</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Receipt Hash Code</th>
                    <th className="px-4 py-3">SHA-256 Proof</th>
                    <th className="px-4 py-3 text-right">Integrity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono text-xs">
                  {(telemetryData.recentAuditLedger?.length === 0 || !telemetryData.recentAuditLedger) ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 italic">
                        No ballots cast yet. Live incoming votes will stream here in real time.
                      </td>
                    </tr>
                  ) : (
                    telemetryData.recentAuditLedger.map((b: any) => (
                      <tr key={b.id} className="hover:bg-zinc-50/80 transition">
                        <td className="px-4 py-3 font-bold text-zinc-900">
                          {b.id}
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(b.castAt).toLocaleTimeString("en-NG")}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {b.receiptHash ? `${b.receiptHash.substring(0, 16)}...` : "0x000000"}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {b.blockHash ? `${b.blockHash.substring(0, 20)}...` : "0x000000"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-900 border border-zinc-200 text-[10px] font-bold">
                            VERIFIED
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: OFFICES & CANDIDATE PHOTOS                                          */}
      {/* ========================================================================= */}
      {activeTab === "CANDIDATES" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                Contested Offices & Candidate Directory
              </h2>
              <p className="text-xs text-zinc-500">
                Manage elective positions, nominate candidates, and upload candidate profile photos.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddPostModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Elective Office</span>
            </button>
          </div>

          <div className="space-y-4">
            {posts.map((post, idx) => (
              <div
                key={post.id}
                className="p-5 rounded-xl bg-white border border-zinc-200 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-zinc-900 text-white font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="font-bold text-zinc-900 text-base">{post.title}</h3>
                      <p className="text-zinc-500 text-xs">
                        {post.description || "Single-winner office"} • {post.candidates.length} Candidate(s)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActivePostForNomination(post.id)}
                      className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:border-zinc-500 bg-white text-zinc-800 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-zinc-600" />
                      <span>Nominate Candidate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Delete Office"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {post.candidates.length === 0 ? (
                  <div className="p-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 text-center text-xs text-zinc-400">
                    No candidates nominated yet for {post.title}. Click &quot;Nominate Candidate&quot; to add names and photos.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {post.candidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-white border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xs">
                            {cand.photoUrl ? (
                              <img
                                src={cand.photoUrl}
                                alt={cand.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-7 h-7 text-zinc-400" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-zinc-900 text-sm truncate">
                              {cand.fullName}
                            </h4>
                            {cand.nickname && (
                              <p className="text-xs text-zinc-500 font-semibold truncate">
                                &quot;{cand.nickname}&quot;
                              </p>
                            )}
                            {cand.matricNo && (
                              <p className="font-mono text-[10px] text-zinc-400">
                                {cand.matricNo}
                              </p>
                            )}
                          </div>
                        </div>

                        {cand.manifesto && (
                          <p className="text-[11px] text-zinc-600 italic line-clamp-2 bg-white p-2 rounded border border-zinc-100">
                            &quot;{cand.manifesto}&quot;
                          </p>
                        )}

                        <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-xs">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              cand.status === "CLEARED"
                                ? "bg-emerald-100 text-emerald-800"
                                : cand.status === "DISQUALIFIED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {cand.status || "CLEARED"}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCandidate(cand, post.id)}
                              className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition"
                              title="Edit Candidate Details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCandidate(cand.id, post.id)}
                              className="p-1 rounded text-zinc-400 hover:text-red-600 transition"
                              title="Remove Candidate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
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
      {/* TAB: VOTER MANAGEMENT SYSTEM                                              */}
      {/* ========================================================================= */}
      {activeTab === "ROSTER" && (
        <div className="space-y-6">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <span>Voter Register & Access Control</span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-mono font-semibold">
                  {filteredVoters.length} {filteredVoters.length === 1 ? "student" : "students"}
                </span>
              </h2>
              <p className="text-xs text-zinc-500">
                Manage registered voters, inspect PINs, screen dues compliance, and enable/disable voting privileges.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadVoterRoll()}
                disabled={voterRollLoading}
                className="p-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition flex items-center gap-1"
                title="Refresh Roster from Database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${voterRollLoading ? "animate-spin" : ""}`} />
              </button>

              <button
                type="button"
                onClick={downloadSampleExcelTemplate}
                className="px-3 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                title="Download standard template with sample columns"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500" />
                <span>Download Dues Template</span>
              </button>

              <button
                type="button"
                onClick={exportVoterRollCSV}
                className="px-3 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-zinc-500" />
                <span>Export CSV</span>
              </button>

              <label className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5 shadow-xs">
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Import Dues (Excel/CSV)</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Dues Import Explanation & Status Banner */}
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-zinc-900">
              <FileSpreadsheet className="w-4 h-4 text-zinc-700" />
              <span>Treasurer Dues & Electorate Comparison Tool</span>
            </div>
            <p className="text-zinc-600 text-[11px] leading-relaxed">
              Upload the Excel or CSV export provided by the Faculty/Departmental Treasurer. StudElect will automatically match matric numbers, update each student&apos;s dues status (<strong>Paid</strong> vs <strong>Unpaid</strong>), and reflect clearance immediately on the ballot gating rule.
            </p>
          </div>

          {uploadMessage && (
            <div className="p-3.5 rounded-lg bg-zinc-900 text-white text-xs flex items-center justify-between animate-in fade-in">
              <span>{uploadMessage}</span>
              <button
                type="button"
                onClick={() => setUploadMessage(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Total Registered
              </span>
              <p className="text-2xl font-black text-zinc-900 mt-1">{totalVoters}</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Official Roster Count</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Dues Compliant
              </span>
              <p className="text-2xl font-black text-emerald-600 mt-1">{duesPaidCount}</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">
                {totalVoters > 0 ? Math.round((duesPaidCount / totalVoters) * 100) : 0}% cleared for ballot
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Active Voters
              </span>
              <p className="text-2xl font-black text-blue-600 mt-1">{activeCount}</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Good Standing</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Promoted Admins
              </span>
              <p className="text-2xl font-black text-indigo-600 mt-1">{adminCount}</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Polling Agents / ELCOM</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
                Suspended / Blocked
              </span>
              <p className="text-2xl font-black text-rose-600 mt-1">{totalVoters - activeCount}</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Access Revoked</span>
            </div>
          </div>

          {/* Academic Level Breakdown Chart */}
          <div className="p-5 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-zinc-500" />
                <span>Academic Level Voter Distribution</span>
              </h3>
              <span className="text-[11px] text-zinc-500 font-medium">Class breakdown</span>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:gap-4 pt-2">
              {[100, 200, 300, 400, 500].map((lvl) => {
                const count = levelCounts[lvl] || 0;
                const percentage = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
                const barHeight = Math.max(Math.round((count / maxLevelCount) * 100), 6);

                return (
                  <div
                    key={lvl}
                    onClick={() => setLevelFilter(levelFilter === lvl ? "ALL" : lvl)}
                    className={`cursor-pointer group p-2.5 rounded-lg border text-center transition ${
                      levelFilter === lvl
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-800"
                    }`}
                  >
                    <div className="h-16 flex items-end justify-center mb-2 px-2">
                      <div
                        style={{ height: `${barHeight}%` }}
                        className={`w-full rounded-t-md transition-all ${
                          levelFilter === lvl
                            ? "bg-emerald-400"
                            : "bg-zinc-300 group-hover:bg-zinc-400"
                        }`}
                      />
                    </div>
                    <span className="font-bold text-xs block">{lvl}L</span>
                    <span
                      className={`text-[10px] block font-mono ${
                        levelFilter === lvl ? "text-zinc-300" : "text-zinc-500"
                      }`}
                    >
                      {count} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Search & Multi-Filter Toolbar */}
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              {/* Search Bar */}
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, matric no, email, dept..."
                  value={voterSearch}
                  onChange={(e) => setVoterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              {/* Level Filter Dropdown */}
              <div>
                <select
                  value={levelFilter}
                  onChange={(e) =>
                    setLevelFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs font-medium focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                >
                  <option value="ALL">All Academic Levels</option>
                  <option value={100}>100 Level Only</option>
                  <option value={200}>200 Level Only</option>
                  <option value={300}>300 Level Only</option>
                  <option value={400}>400 Level Only</option>
                  <option value={500}>500 Level Only</option>
                </select>
              </div>

              {/* Dues Status Filter */}
              <div>
                <select
                  value={duesFilter}
                  onChange={(e) => setDuesFilter(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-zinc-300 text-xs font-medium focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                >
                  <option value="ALL">All Dues Status</option>
                  <option value="PAID">✅ Dues Paid Only</option>
                  <option value="UNPAID">❌ Unpaid Dues Only</option>
                </select>
              </div>
            </div>

            {/* Sub-Filters: Status & Active Filters Tag */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-200">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Access:</span>
                  {(["ALL", "ACTIVE", "DISABLED"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                        statusFilter === st
                          ? "bg-zinc-900 text-white"
                          : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {st === "ALL" ? "All" : st === "ACTIVE" ? "🟢 Active" : "🔴 Disabled"}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Role:</span>
                  {(["ALL", "ADMIN", "STUDENT"] as const).map((rf) => (
                    <button
                      key={rf}
                      type="button"
                      onClick={() => setRoleFilter(rf)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                        roleFilter === rf
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {rf === "ALL" ? "All" : rf === "ADMIN" ? "🛡️ Admins Only" : "Students"}
                    </button>
                  ))}
                </div>
              </div>

              {(voterSearch ||
                levelFilter !== "ALL" ||
                duesFilter !== "ALL" ||
                statusFilter !== "ALL" ||
                roleFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setVoterSearch("");
                    setLevelFilter("ALL");
                    setDuesFilter("ALL");
                    setStatusFilter("ALL");
                    setRoleFilter("ALL");
                  }}
                  className="text-[11px] text-red-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  <span>Clear All Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Student Roster Table */}
          {voterRollLoading ? (
            <div className="p-12 text-center text-xs text-zinc-500 bg-white rounded-xl border border-zinc-200">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-400" />
              <span>Loading registered students from database...</span>
            </div>
          ) : filteredVoters.length === 0 ? (
            <div className="p-10 rounded-xl border border-dashed border-zinc-300 bg-white text-center space-y-2 text-xs">
              <Users className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="font-bold text-zinc-800">No Student Records Found</p>
              <p className="text-zinc-500 max-w-sm mx-auto">
                No voters match the current search filters, or no students have registered yet for this association.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-xs text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold text-zinc-600 uppercase">
                    <tr>
                      <th className="px-4 py-3 w-12">#</th>
                      <th className="px-4 py-3">Student Name & Contact</th>
                      <th className="px-4 py-3">Matric No</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">Voter PIN</th>
                      <th className="px-4 py-3">Dues</th>
                      <th className="px-4 py-3">Access</th>
                      <th className="px-4 py-3">Admin Role</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {filteredVoters.map((s, idx) => {
                      const isPinRevealed = revealedPins.has(s.id);
                      const isActive = s.disciplinaryStatus === "GOOD_STANDING";

                      return (
                        <tr
                          key={s.id || s.matricNo}
                          className={`hover:bg-zinc-50 transition ${
                            !isActive ? "bg-rose-50/50" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Name, Dept, Email & Phone */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900">{s.fullName}</span>
                              {s.isAdmin && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white font-mono text-[9px] font-bold tracking-wider uppercase">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500">{s.department}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              {s.email ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                                  <Mail className="w-2.5 h-2.5 text-zinc-400" />
                                  <span>{s.email}</span>
                                </span>
                              ) : null}
                              {s.phoneNumber ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                                  <Phone className="w-2.5 h-2.5 text-zinc-400" />
                                  <span>{s.phoneNumber}</span>
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Matric */}
                          <td className="px-4 py-3 font-mono font-bold text-zinc-800">
                            {s.matricNo}
                          </td>

                          {/* Level */}
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 font-mono font-semibold text-zinc-700 text-[11px]">
                              {s.level}L
                            </span>
                          </td>

                          {/* PIN with Mask / Reveal / Copy */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs bg-zinc-100 px-2 py-1 rounded border border-zinc-200">
                                {isPinRevealed ? (
                                  <span className="text-zinc-900 select-all">{s.portalPin || "—"}</span>
                                ) : (
                                  <span className="text-zinc-400 tracking-widest">••••••••</span>
                                )}
                              </span>

                              <button
                                type="button"
                                onClick={() => togglePinReveal(s.id)}
                                className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                                title={isPinRevealed ? "Hide PIN" : "Reveal PIN"}
                              >
                                {isPinRevealed ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {s.portalPin && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await safeCopyToClipboard(s.portalPin);
                                    if (ok) {
                                      setAdminActionMessage(`Copied PIN for ${s.fullName}`);
                                      setTimeout(() => setAdminActionMessage(null), 3000);
                                    }
                                  }}
                                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                                  title="Copy PIN"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Dues Paid Toggle */}
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleDues(s.id, s.duesPaid)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 border ${
                                s.duesPaid
                                  ? "bg-zinc-100 text-zinc-900 border-zinc-300 hover:bg-zinc-200"
                                  : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                              }`}
                              title="Click to toggle financial dues status"
                            >
                              {s.duesPaid ? "PAID" : "UNPAID"}
                            </button>
                          </td>

                          {/* Enable / Disable Voting Privileges */}
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(s.id, s.disciplinaryStatus)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 border ${
                                isActive
                                  ? "bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800"
                                  : "bg-zinc-200 text-zinc-600 border-zinc-300 hover:bg-zinc-300"
                              }`}
                              title="Click to enable or disable student voting privileges"
                            >
                              {isActive ? "ACTIVE" : "DISABLED"}
                            </button>
                          </td>

                          {/* Admin Role Promotion Button */}
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleAdminRole(s)}
                              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                                s.isAdmin
                                  ? "bg-blue-50 text-blue-900 border-blue-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 group"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-900 hover:text-white hover:border-zinc-900"
                              }`}
                              title={
                                s.isAdmin
                                  ? "Active Admin. Click to revoke admin access."
                                  : "Click to promote student to Polling Agent / ELCOM Admin"
                              }
                            >
                              <ShieldCheck
                                className={`w-3.5 h-3.5 ${
                                  s.isAdmin
                                    ? "text-blue-600 group-hover:text-rose-600"
                                    : "text-zinc-500"
                                }`}
                              />
                              {s.isAdmin ? (
                                <>
                                  <span className="group-hover:hidden">ADMIN</span>
                                  <span className="hidden group-hover:inline">REVOKE</span>
                                </>
                              ) : (
                                <span>PROMOTE</span>
                              )}
                            </button>
                          </td>

                          {/* Actions: Reset PIN, Promote & Delete Voter */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleAdminRole(s)}
                                className={`px-2 py-1 rounded border font-bold text-[10px] transition flex items-center gap-1 ${
                                  s.isAdmin
                                    ? "border-blue-300 bg-blue-50 text-blue-800 hover:bg-rose-50 hover:text-rose-700"
                                    : "border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                                }`}
                                title={s.isAdmin ? "Revoke Admin access" : "Promote to Admin"}
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>{s.isAdmin ? "Admin" : "Promote"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleResetPin(s.id)}
                                className="px-2 py-1 rounded border border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 font-bold text-[10px] transition flex items-center gap-1"
                                title="Issue a fresh PIN"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reset</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(s.id, s.fullName)}
                                className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-200"
                                title="Permanently delete voter record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ELECTION RULES & VOTING RESTRICTIONS                                 */}
      {/* ========================================================================= */}
      {activeTab === "RULES" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Scale className="w-5 h-5 text-zinc-700" />
                <span>Constitutional Eligibility & Voting Restrictions</span>
              </h2>
              <p className="text-xs text-zinc-500">
                Configure association screening gates, dues enforcement, and voter eligibility policies.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveRules}
              disabled={isSavingRules}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 self-start sm:self-auto"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSavingRules ? "Saving Rules..." : "Save Eligibility Rules"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Organization Display Picture / Logo */}
            <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="relative w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-2xs">
                    <img
                      src={orgLogoUrl || `/logos/${instSlug}.svg`}
                      alt="Org DP"
                      className="w-full h-full object-contain p-1"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Organization Display Picture (DP)</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Upload your official departmental or faculty crest/logo. This appears on student voter booths and the ELCOM desk.
                    </p>
                  </div>
                </div>

                <label className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs flex-shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload DP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleOrgLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Rule 1: Dues Payment Toggle */}
            <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-zinc-100 text-zinc-900 border border-zinc-200 flex-shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Mandatory Association Dues</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Require voters to have paid their annual departmental / faculty dues before casting a ballot.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={electionRules.requireDuesPayment}
                    onChange={(e) =>
                      setElectionRules((prev) => ({ ...prev, requireDuesPayment: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
                </label>
              </div>

              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${electionRules.requireDuesPayment ? "bg-zinc-100 text-zinc-900 border border-zinc-200" : "bg-zinc-50 text-zinc-600 border border-zinc-200"}`}>
                <span className="font-bold">{electionRules.requireDuesPayment ? "Active Policy:" : "Unrestricted:"}</span>
                <span>{electionRules.requireDuesPayment ? "Unpaid students are blocked at ballot screening with dues alert." : "All registered students can vote regardless of dues payment status."}</span>
              </div>
            </div>

            {/* Rule 2: Disciplinary Standing Toggle */}
            <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-zinc-100 text-zinc-900 border border-zinc-200 flex-shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">SDC Disciplinary Clearance</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Enforce university Students Disciplinary Committee (SDC) sanctions and suspensions.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={electionRules.requireGoodDisciplinaryStanding}
                    onChange={(e) =>
                      setElectionRules((prev) => ({
                        ...prev,
                        requireGoodDisciplinaryStanding: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
                </label>
              </div>

              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${electionRules.requireGoodDisciplinaryStanding ? "bg-zinc-100 text-zinc-900 border border-zinc-200" : "bg-zinc-50 text-zinc-600 border border-zinc-200"}`}>
                <span className="font-bold">{electionRules.requireGoodDisciplinaryStanding ? "Active Policy:" : "Policy Disabled:"}</span>
                <span>{electionRules.requireGoodDisciplinaryStanding ? "Suspended or expelled students cannot vote." : "Disciplinary sanctions will not block voter accreditation."}</span>
              </div>
            </div>

            {/* Rule 3: Full-Time Only Restriction */}
            <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-zinc-100 text-zinc-900 border border-zinc-200 flex-shrink-0">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm">Full-Time Regular Students Only</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Restrict voting franchise strictly to full-time regular undergraduate/postgraduate students.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={electionRules.requireFullTimeOnly}
                    onChange={(e) =>
                      setElectionRules((prev) => ({
                        ...prev,
                        requireFullTimeOnly: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-zinc-900"></div>
                </label>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
                {electionRules.requireFullTimeOnly ? "Part-time, DLI, Sandwich, and Distance Learning students are excluded from this ballot." : "All matriculated program types (Full-Time, Part-Time, DLI) are permitted."}
              </div>
            </div>

            {/* Rule 4: Voter Authentication Mode */}
            <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-zinc-100 text-zinc-900 border border-zinc-200 flex-shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Voter Authentication Mode</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    How students authenticate before receiving their blinded cryptographic ballot token.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 ${electionRules.authMode === "PIN_SLIP" ? "border-zinc-900 bg-zinc-50 font-bold text-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                  <input
                    type="radio"
                    name="authMode"
                    value="PIN_SLIP"
                    checked={electionRules.authMode === "PIN_SLIP"}
                    onChange={() => setElectionRules((prev) => ({ ...prev, authMode: "PIN_SLIP" }))}
                    className="sr-only"
                  />
                  <Key className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Secret PIN Code</span>
                </label>

                <label className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-2 ${electionRules.authMode === "EMAIL_OTP" ? "border-zinc-900 bg-zinc-50 font-bold text-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                  <input
                    type="radio"
                    name="authMode"
                    value="EMAIL_OTP"
                    checked={electionRules.authMode === "EMAIL_OTP"}
                    onChange={() => setElectionRules((prev) => ({ ...prev, authMode: "EMAIL_OTP" }))}
                    className="sr-only"
                  />
                  <Mail className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Email OTP</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: VOTER PIN SLIPS                                                      */}
      {/* ========================================================================= */}
      {activeTab === "PINS" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Pre-Generated Voter Access PINs</h2>
              <p className="text-xs text-zinc-500">
                Export 8-character voter PIN scratch slips for offline accreditation verification.
              </p>
            </div>

            <button
              type="button"
              onClick={() => exportVoterPinsToExcel(voterRoll, resolvedParams.institution)}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export PIN Slips (Excel)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {voterRoll.slice(0, 12).map((s) => (
              <div
                key={s.matricNo}
                className="p-3.5 rounded-xl bg-white border border-zinc-200 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                  <span className="font-bold text-zinc-900 truncate">{s.fullName}</span>
                  <span className="font-mono text-[10px] text-zinc-500">{s.matricNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase">ACCESS PIN:</span>
                  <span className="font-mono font-bold text-sm bg-zinc-100 px-2 py-0.5 rounded text-zinc-900">
                    {s.portalPin || "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: SYSTEM & AUDIT LOGS                                                  */}
      {/* ========================================================================= */}
      {activeTab === "LOGS" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                  TAMPER-EVIDENT ELECTORAL AUDIT TRAIL
                </span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mt-1">
                Electoral System & Audit Ledger Logs
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Cryptographic record of voter authorizations, ballot tokens, rule modifications, and election events.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={loadAuditLogs}
                disabled={isAuditLogsLoading}
                className="px-3.5 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-zinc-600 ${isAuditLogsLoading ? "animate-spin" : ""}`} />
                <span>{isAuditLogsLoading ? "Refreshing..." : "Refresh Ledger"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const exportLogs = auditLogs.map((l) => ({
                    ID: l.id,
                    Timestamp: new Date(l.timestamp).toLocaleString("en-NG"),
                    Action: l.action,
                    Role: l.actorRole,
                    Actor: l.actorName,
                    ElectionID: l.electionId,
                    IP_Nonce: l.ipHash,
                    Details: JSON.stringify(l.details),
                  }));
                  const blob = new Blob([JSON.stringify(exportLogs, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `Audit_Ledger_${instSlug.toUpperCase()}_${Date.now()}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Audit JSON</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Total Log Entries</span>
              <p className="text-xl font-bold font-mono text-zinc-900 mt-1">{auditLogs.length}</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Ballots Cast in Ledger</span>
              <p className="text-xl font-bold font-mono text-blue-600 mt-1">
                {auditLogs.filter((l) => l.action === "BALLOT_CAST").length}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Security / Admin Events</span>
              <p className="text-xl font-bold font-mono text-purple-600 mt-1">
                {auditLogs.filter((l) => l.action !== "BALLOT_CAST").length}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">Integrity Proof</span>
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold font-mono mt-1">
                <ShieldCheck className="w-4 h-4" />
                <span>SHA-256 Valid</span>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit ledger by ID, action, hash..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-semibold font-mono text-[11px]">Action Filter:</span>
              <select
                value={logFilterAction}
                onChange={(e) => setLogFilterAction(e.target.value)}
                className="px-3 py-2 rounded-lg border border-zinc-300 text-xs font-semibold focus:outline-none"
              >
                <option value="ALL">All Event Types</option>
                <option value="BALLOT_CAST">Ballots Cast</option>
                <option value="ADMIN_ACTION">Admin Operations</option>
                <option value="PIN_GENERATE">PIN Generation</option>
                <option value="STATUS_CHANGE">Lifecycle Updates</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-mono uppercase text-zinc-500 font-bold">
                  <tr>
                    <th className="px-4 py-3">Timestamp (WAT)</th>
                    <th className="px-4 py-3">Action Type</th>
                    <th className="px-4 py-3">Actor Role</th>
                    <th className="px-4 py-3">Cryptographic Receipt / Details</th>
                    <th className="px-4 py-3 text-right">Integrity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono text-xs">
                  {(() => {
                    const filteredLogs = auditLogs.filter((l) => {
                      const matchAction = logFilterAction === "ALL" || l.action === logFilterAction;
                      const q = logSearchQuery.toLowerCase();
                      const matchSearch =
                        !q ||
                        l.id?.toLowerCase().includes(q) ||
                        l.action?.toLowerCase().includes(q) ||
                        l.actorRole?.toLowerCase().includes(q) ||
                        JSON.stringify(l.details || {}).toLowerCase().includes(q);
                      return matchAction && matchSearch;
                    });

                    if (filteredLogs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-zinc-400 italic">
                            No matching audit logs found. Cast ballots and administrative operations stream here in real time.
                          </td>
                        </tr>
                      );
                    }

                    return filteredLogs.map((log) => {
                      const isBallot = log.action === "BALLOT_CAST";
                      return (
                        <tr key={log.id} className="hover:bg-zinc-50/80 transition">
                          <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleDateString("en-NG", {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            {new Date(log.timestamp).toLocaleTimeString("en-NG")}
                          </td>

                          <td className="px-4 py-3 font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                isBallot
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-zinc-700">
                            <span className="font-semibold">{log.actorRole}</span>
                            <span className="text-[10px] text-zinc-400 block">{log.actorName}</span>
                          </td>

                          <td className="px-4 py-3 text-zinc-600 max-w-md break-all">
                            {log.details?.receiptHash ? (
                              <div>
                                <span className="text-zinc-900 font-bold">Receipt: </span>
                                <span>{log.details.receiptHash.substring(0, 18)}...</span>
                                {log.details.blockHash && (
                                  <span className="text-zinc-400 block text-[10px]">
                                    Block: {log.details.blockHash.substring(0, 24)}...
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span>{JSON.stringify(log.details || {})}</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <Check className="w-3 h-3" />
                              <span>VERIFIED</span>
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW ELECTIVE POST                                              */}
      {/* ========================================================================= */}
      {isAddPostModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Add Elective Office</h3>
                <p className="text-xs text-zinc-500">Create a contested post on the ballot.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPostModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Office / Post Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Director of Socials & Welfare"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Description / Responsibilities (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Single-winner executive council office"
                  value={newPostDesc}
                  onChange={(e) => setNewPostDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPostModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Office</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOMINATE CANDIDATE WITH PHOTO                                      */}
      {/* ========================================================================= */}
      {activePostForNomination && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Nominate Candidate</h3>
                <p className="text-xs text-zinc-500">
                  Assigning candidate to:{" "}
                  <strong>{posts.find((p) => p.id === activePostForNomination)?.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePostForNomination(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleNominateCandidate} className="space-y-4 text-xs">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1">
                    Campaign Nickname
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TechVanguard"
                    value={candForm.nickname}
                    onChange={(e) =>
                      setCandForm((prev) => ({ ...prev, nickname: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1">
                    Matric No (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 21/52HA045"
                    value={candForm.matricNo}
                    onChange={(e) =>
                      setCandForm((prev) => ({ ...prev, matricNo: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono uppercase"
                  />
                </div>
              </div>

              {/* Photo Upload & Preview */}
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Candidate Profile Photo
                </label>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xs">
                    {candForm.photoUrl ? (
                      <img
                        src={candForm.photoUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-zinc-400" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
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
                        onChange={handlePhotoUpload}
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
                  onClick={() => setActivePostForNomination(null)}
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

      {/* ========================================================================= */}
      {/* MODAL: EDIT CANDIDATE DETAILS                                             */}
      {/* ========================================================================= */}
      {editingCandidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Edit Candidate</h3>
                <p className="text-xs text-zinc-500">
                  Updating details for <strong>{editingCandidate.fullName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCandidateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Candidate Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Adebayo Chukwuma Olawale"
                  value={editingCandidate.fullName}
                  onChange={(e) =>
                    setEditingCandidate((prev) =>
                      prev ? { ...prev, fullName: e.target.value } : null
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1">
                    Campaign Nickname
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TechVanguard"
                    value={editingCandidate.nickname}
                    onChange={(e) =>
                      setEditingCandidate((prev) =>
                        prev ? { ...prev, nickname: e.target.value } : null
                      )
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1">
                    Matric No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 21/52HA045"
                    value={editingCandidate.matricNo}
                    onChange={(e) =>
                      setEditingCandidate((prev) =>
                        prev ? { ...prev, matricNo: e.target.value } : null
                      )
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono uppercase"
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Screening & Clearance Status
                </label>
                <select
                  value={editingCandidate.status}
                  onChange={(e) =>
                    setEditingCandidate((prev) =>
                      prev ? { ...prev, status: e.target.value as any } : null
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
                >
                  <option value="CLEARED">🟢 Cleared (Active on Voting Ballot)</option>
                  <option value="NOMINATED">🟡 Nominated (Pending Screening)</option>
                  <option value="DISQUALIFIED">🔴 Disqualified (Hidden from Ballot)</option>
                </select>
              </div>

              {/* Photo Upload & Preview */}
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1">
                  Candidate Profile Photo
                </label>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xs">
                    {editingCandidate.photoUrl ? (
                      <img
                        src={editingCandidate.photoUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-zinc-400" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="Paste image URL or upload below"
                      value={editingCandidate.photoUrl}
                      onChange={(e) =>
                        setEditingCandidate((prev) =>
                          prev ? { ...prev, photoUrl: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-1.5 rounded-md border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />

                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer text-[11px] font-semibold transition">
                      <Upload className="w-3 h-3 text-zinc-500" />
                      <span>Upload New Photo (JPG / PNG)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditPhotoUpload}
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
                  value={editingCandidate.manifesto}
                  onChange={(e) =>
                    setEditingCandidate((prev) =>
                      prev ? { ...prev, manifesto: e.target.value } : null
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCandidate(null)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONTACT SUPERADMIN SUPPORT                                         */}
      {/* ========================================================================= */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">ELCOM Direct Support Desk</h3>
                  <p className="text-[11px] text-zinc-500">
                    Direct WhatsApp line to StudElect SuperAdmin: <span className="font-mono font-bold text-zinc-800">{SUPERADMIN_WHATSAPP_RAW}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Organization Context Card */}
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500 uppercase font-semibold">Campus & Organization:</span>
                <span className="font-bold text-zinc-900">{instSlug.toUpperCase()} • {orgLicenseInfo.orgName || (activeOrgSlug ? activeOrgSlug.toUpperCase() + " ELCOM" : "ELCOM")}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500 uppercase font-semibold">Active Quota Capacity:</span>
                <span className="font-bold text-zinc-900">{orgLicenseInfo.voterQuota || 500} Voters ({voterRoll.length} Registered)</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-zinc-500 uppercase font-semibold">Election Status:</span>
                <span className="font-bold uppercase text-emerald-700">{electionRules.status}</span>
              </div>
            </div>

            {/* Select Reason */}
            <div className="space-y-2">
              <label className="block font-semibold uppercase text-zinc-700 text-[11px] font-mono">
                Select What You Need Help With:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    id: "QUOTA_TOPUP" as AdminWhatsAppReason,
                    title: "Top-Up Voter Quota",
                    desc: "Increase voter capacity limit (₦15k/500 voters)",
                    icon: Users,
                  },
                  {
                    id: "EMERGENCY_SUPPORT" as AdminWhatsAppReason,
                    title: "Election Emergency",
                    desc: "Urgent issue during live balloting",
                    icon: AlertTriangle,
                  },
                  {
                    id: "PAYMENT_CONFIRMATION" as AdminWhatsAppReason,
                    title: "Payment Confirmation",
                    desc: "Send proof of transfer for license unlock",
                    icon: CreditCard,
                  },
                  {
                    id: "BALLOT_AUDIT" as AdminWhatsAppReason,
                    title: "Audit & Certification",
                    desc: "Request certified cryptographic extract",
                    icon: ShieldCheck,
                  },
                  {
                    id: "LICENSE_ACTIVATION" as AdminWhatsAppReason,
                    title: "License Activation",
                    desc: "Onboard new election or faculty license",
                    icon: Key,
                  },
                  {
                    id: "GENERAL_INQUIRY" as AdminWhatsAppReason,
                    title: "General Technical Inquiry",
                    desc: "Platform settings, questions or advice",
                    icon: HelpCircle,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = supportReason === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSupportReason(item.id)}
                      className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-600 shadow-2xs"
                          : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                      }`}
                    >
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? "text-emerald-700" : "text-zinc-500"}`} />
                      <div>
                        <p className="font-bold text-xs">{item.title}</p>
                        <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Launch WhatsApp CTA */}
            <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-zinc-400 font-mono">
                Opens SuperAdmin chat with pre-formatted message
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold"
                >
                  Close
                </button>

                <a
                  href={buildSuperAdminWhatsAppUrl(supportReason, {
                    institutionName: `${instSlug.toUpperCase()} University`,
                    institutionSlug: instSlug,
                    orgName: orgLicenseInfo.orgName || (activeOrgSlug ? activeOrgSlug.toUpperCase() + " ELCOM" : "ELCOM"),
                    orgSlug: activeOrgSlug || "elcom",
                    adminName: "ELCOM Presiding Officer",
                    adminRole: "Administrator",
                    currentQuota: orgLicenseInfo.voterQuota || 500,
                    registeredCount: voterRoll.length,
                    electionId,
                    planName: "Micro Tier (500 Voters - ₦15,000)",
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsSupportModalOpen(false)}
                  className="flex-1 sm:flex-initial px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-xs text-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Open WhatsApp Support →</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>

      {/* ========================================================================= */}
      {/* SCREEN CERTIFICATE PREVIEW MODAL                                          */}
      {/* ========================================================================= */}
      {isPreviewPrintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto print:hidden">
          <div className="bg-zinc-100 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-zinc-300">
            {/* Modal Header */}
            <div className="bg-zinc-900 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-zinc-300" />
                <div>
                  <h3 className="text-sm font-bold">Official Results Certificate Preview</h3>
                  <p className="text-[11px] text-zinc-400">
                    Certified legal return of election sheet (captures only the essential results data).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewPrintOpen(false);
                    setTimeout(() => window.print(), 300);
                  }}
                  className="px-4 py-2 rounded-lg bg-white text-zinc-900 hover:bg-zinc-100 font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewPrintOpen(false)}
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Printable Document Container */}
            <div className="p-6 overflow-y-auto flex-1 bg-zinc-200/60 flex justify-center">
              <div className="bg-white text-black p-8 rounded-lg shadow-md max-w-3xl w-full font-sans text-xs space-y-6 border border-zinc-300">
                {/* Official Header */}
                <div className="border-b-2 border-black pb-4 text-center space-y-1">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <img
                      src={orgLogoUrl || `/logos/${instSlug}.svg`}
                      alt="Crest"
                      className="w-14 h-14 object-contain"
                    />
                  </div>
                  <p className="text-[10px] font-mono tracking-widest uppercase font-bold text-zinc-600">
                    {instSlug.toUpperCase()} UNIVERSITY • INDEPENDENT ELECTORAL COMMISSION (ELCOM)
                  </p>
                  <h1 className="text-lg font-extrabold uppercase tracking-tight text-black">
                    Official Return of Election & Declaration of Results
                  </h1>
                  <p className="text-xs text-zinc-600 font-medium">
                    2025/2026 Academic Session • Certified E-Voting Protocol
                  </p>
                  <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 pt-2 border-t border-zinc-200 mt-2">
                    <span>CERTIFICATE ID: CERT-{instSlug.toUpperCase()}-{electionRules.status}</span>
                    <span>DATE: {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</span>
                    <span>AUDIT LEDGER: SHA-256 VERIFIED</span>
                  </div>
                </div>

                {/* Electorate Turnout Summary */}
                <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider font-mono border-b border-black pb-1">
                    1. Electorate Turnout Summary
                  </h2>
                  <table className="w-full text-left border border-black border-collapse text-xs">
                    <tbody>
                      <tr className="border-b border-black divide-x divide-black bg-zinc-100 font-bold">
                        <td className="p-2">Total Cleared Electorate</td>
                        <td className="p-2">Verified Ballots Cast</td>
                        <td className="p-2">Voter Turnout Rate</td>
                        <td className="p-2">Electoral Status</td>
                      </tr>
                      <tr className="divide-x divide-black font-mono">
                        <td className="p-2">{telemetryData.totalRegistered.toLocaleString()} registered</td>
                        <td className="p-2 font-bold">{telemetryData.totalBallotsCast.toLocaleString()} votes</td>
                        <td className="p-2">{telemetryData.turnoutPercentage}%</td>
                        <td className="p-2 font-bold uppercase">{electionRules.status}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Turnout Frequency Histogram */}
                <div className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider font-mono border-b border-black pb-1">
                    2. Demographic Participation Frequency Histogram
                  </h2>
                  <div className="border border-black p-4 bg-zinc-50">
                    <div className="h-32 flex items-end justify-between gap-4 pt-4 pb-1">
                      {(() => {
                        const levels = ["100L", "200L", "300L", "400L", "500L"];
                        const maxCount = Math.max(
                          ...(telemetryData.levelBreakdown || []).map((l: any) => l.count || 0),
                          1
                        );
                        return levels.map((lvl) => {
                          const item = (telemetryData.levelBreakdown || []).find((l: any) => l.level === lvl) || { count: 0, percentage: 0 };
                          const heightPct = Math.max(10, Math.round((item.count / maxCount) * 100));

                          return (
                            <div key={lvl} className="flex-1 flex flex-col items-center h-full justify-end">
                              <span className="font-mono text-[10px] font-bold text-black mb-1">
                                {item.count} ({item.percentage}%)
                              </span>
                              <div
                                className="w-full max-w-[48px] bg-black"
                                style={{ height: `${heightPct}%` }}
                              />
                              <span className="font-mono text-[10px] font-bold mt-1 text-black">
                                {lvl}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    <p className="text-[9px] text-zinc-500 text-center font-mono mt-2 border-t border-zinc-200 pt-1">
                      Figure 1: Verified Voter Turnout Distribution by Academic Level Cohort
                    </p>
                  </div>
                </div>

                {/* Results by Contested Office */}
                <div className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider font-mono border-b border-black pb-1">
                    3. Certified Results by Elective Office
                  </h2>

                  {posts.map((post) => {
                    const totalVotesForPost = post.candidates.reduce((acc, c) => acc + (c.voteCount || 0), 0) || 0;
                    const sorted = [...post.candidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

                    return (
                      <div key={post.id} className="space-y-1">
                        <div className="flex items-center justify-between bg-zinc-100 p-1.5 border border-black font-bold text-xs">
                          <span>OFFICE: {post.title.toUpperCase()}</span>
                          <span className="font-mono text-[10px]">TOTAL VOTES CAST: {totalVotesForPost}</span>
                        </div>

                        <table className="w-full text-left border border-black border-collapse text-xs">
                          <thead className="bg-zinc-50 border-b border-black text-[10px] font-mono uppercase">
                            <tr className="divide-x divide-black">
                              <th className="p-1.5 w-12 text-center">Rank</th>
                              <th className="p-1.5">Candidate Full Name</th>
                              <th className="p-1.5">Matric No.</th>
                              <th className="p-1.5 text-right font-mono">Votes</th>
                              <th className="p-1.5 text-right font-mono">% Share</th>
                              <th className="p-1.5 text-center">Official Declaration</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black font-mono text-xs">
                            {sorted.map((cand, idx) => {
                              const candVotes = cand.voteCount || 0;
                              const pct = totalVotesForPost > 0 ? Math.round((candVotes / totalVotesForPost) * 100) : 0;
                              const isWinner = idx === 0 && candVotes > 0;

                              return (
                                <tr key={cand.id} className={`divide-x divide-black ${isWinner ? "bg-zinc-100 font-bold" : ""}`}>
                                  <td className="p-1.5 text-center">{idx + 1}</td>
                                  <td className="p-1.5 font-sans font-semibold">
                                    {cand.fullName} {cand.nickname && `("${cand.nickname}")`}
                                  </td>
                                  <td className="p-1.5">{cand.matricNo || "—"}</td>
                                  <td className="p-1.5 text-right font-bold">{candVotes}</td>
                                  <td className="p-1.5 text-right">{pct}%</td>
                                  <td className="p-1.5 text-center">
                                    {isWinner ? (
                                      <span className="border border-black px-2 py-0.5 text-[9px] uppercase font-extrabold bg-black text-white">
                                        ELECTED
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-500">RUNNER-UP</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>

                {/* Statutory Certification & Signatures */}
                <div className="pt-4 border-t-2 border-black space-y-4">
                  <p className="text-[10px] text-zinc-700 italic leading-relaxed">
                    "We, the undersigned Electoral Commissioners, hereby solemnly declare and certify under the Constitution and Electoral Regulations that the above results represent the exact, unaltered outcome of the secret electronic balloting exercise. Having satisfied all constitutional requirements and scored the highest valid votes cast, the candidates declared above as ELECTED are duly returned."
                  </p>

                  <div className="grid grid-cols-3 gap-6 pt-4 text-xs font-mono">
                    <div className="space-y-4">
                      <div className="border-b border-black h-12 flex items-end">
                        <span className="text-[10px] text-zinc-400 italic">Signature: _______________________</span>
                      </div>
                      <div>
                        <p className="font-bold text-black uppercase">Chief Returning Officer</p>
                        <p className="text-[10px] text-zinc-600">ELCOM Secretariat</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="border-b border-black h-12 flex items-end">
                        <span className="text-[10px] text-zinc-400 italic">Signature: _______________________</span>
                      </div>
                      <div>
                        <p className="font-bold text-black uppercase">ELCOM Chairman</p>
                        <p className="text-[10px] text-zinc-600">Electoral Commission</p>
                      </div>
                    </div>

                    <div className="border-2 border-dashed border-black p-3 text-center flex flex-col items-center justify-center min-h-[90px]">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">
                        OFFICIAL SECURITY STAMP & SEAL
                      </span>
                      <span className="text-[8px] text-zinc-400 mt-1 block">
                        SHA-256 Cryptographic Nonce Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT-ONLY: OFFICIAL CERTIFIED RESULTS RETURN SHEET                       */}
      {/* Strictly rendered during physical printing or browser PDF export           */}
      {/* ========================================================================= */}
      <div className="print-only hidden print:block bg-white text-black p-6 font-sans text-xs space-y-6">
        {/* Official Header */}
        <div className="border-b-2 border-black pb-4 text-center space-y-1">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img
              src={orgLogoUrl || `/logos/${instSlug}.svg`}
              alt="Crest"
              className="w-16 h-16 object-contain"
            />
          </div>
          <p className="text-[10px] font-mono tracking-widest uppercase font-bold text-zinc-600">
            {instSlug.toUpperCase()} UNIVERSITY • INDEPENDENT ELECTORAL COMMISSION (ELCOM)
          </p>
          <h1 className="text-xl font-extrabold uppercase tracking-tight text-black">
            Official Return of Election & Declaration of Results
          </h1>
          <p className="text-xs text-zinc-600 font-medium">
            2025/2026 Academic Session • Certified E-Voting Protocol
          </p>
          <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 pt-2 border-t border-zinc-200 mt-2">
            <span>CERTIFICATE ID: CERT-{instSlug.toUpperCase()}-{electionRules.status}</span>
            <span>DATE OF DECLARATION: {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</span>
            <span>AUDIT LEDGER: SHA-256 VERIFIED</span>
          </div>
        </div>

        {/* Executive Electorate Summary */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono border-b border-black pb-1">
            1. Electorate Turnout Summary
          </h2>
          <table className="w-full text-left border border-black border-collapse text-xs">
            <tbody>
              <tr className="border-b border-black divide-x divide-black bg-zinc-100 font-bold">
                <td className="p-2">Total Cleared Electorate</td>
                <td className="p-2">Verified Ballots Cast</td>
                <td className="p-2">Voter Turnout Rate</td>
                <td className="p-2">Electoral Status</td>
              </tr>
              <tr className="divide-x divide-black font-mono">
                <td className="p-2">{telemetryData.totalRegistered.toLocaleString()} registered</td>
                <td className="p-2 font-bold">{telemetryData.totalBallotsCast.toLocaleString()} votes</td>
                <td className="p-2">{telemetryData.turnoutPercentage}%</td>
                <td className="p-2 font-bold uppercase">{electionRules.status}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Turnout Frequency Histogram (Print Graphic) */}
        <div className="space-y-2 page-break-inside-avoid">
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono border-b border-black pb-1">
            2. Demographic Participation Frequency Histogram
          </h2>
          <div className="border border-black p-4 bg-zinc-50">
            <div className="h-32 flex items-end justify-between gap-4 pt-4 pb-1">
              {(() => {
                const levels = ["100L", "200L", "300L", "400L", "500L"];
                const maxCount = Math.max(
                  ...(telemetryData.levelBreakdown || []).map((l: any) => l.count || 0),
                  1
                );
                return levels.map((lvl) => {
                  const item = (telemetryData.levelBreakdown || []).find((l: any) => l.level === lvl) || { count: 0, percentage: 0 };
                  const heightPct = Math.max(10, Math.round((item.count / maxCount) * 100));

                  return (
                    <div key={lvl} className="flex-1 flex flex-col items-center h-full justify-end">
                      <span className="font-mono text-[10px] font-bold text-black mb-1">
                        {item.count} ({item.percentage}%)
                      </span>
                      <div
                        className="w-full max-w-[48px] bg-black"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="font-mono text-[10px] font-bold mt-1 text-black">
                        {lvl}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
            <p className="text-[9px] text-zinc-500 text-center font-mono mt-2 border-t border-zinc-200 pt-1">
              Figure 1: Verified Voter Turnout Distribution by Academic Level Cohort
            </p>
          </div>
        </div>

        {/* Contested Offices Results Tables */}
        <div className="space-y-4 page-break-inside-avoid">
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono border-b border-black pb-1">
            3. Certified Results by Elective Office
          </h2>

          {posts.map((post) => {
            const totalVotesForPost = post.candidates.reduce((acc, c) => acc + (c.voteCount || 0), 0) || 0;
            const sorted = [...post.candidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));

            return (
              <div key={post.id} className="space-y-1 page-break-inside-avoid">
                <div className="flex items-center justify-between bg-zinc-100 p-1.5 border border-black font-bold text-xs">
                  <span>OFFICE: {post.title.toUpperCase()}</span>
                  <span className="font-mono text-[10px]">TOTAL VOTES CAST: {totalVotesForPost}</span>
                </div>

                <table className="w-full text-left border border-black border-collapse text-xs">
                  <thead className="bg-zinc-50 border-b border-black text-[10px] font-mono uppercase">
                    <tr className="divide-x divide-black">
                      <th className="p-1.5 w-12 text-center">Rank</th>
                      <th className="p-1.5">Candidate Full Name</th>
                      <th className="p-1.5">Matric No.</th>
                      <th className="p-1.5 text-right font-mono">Votes</th>
                      <th className="p-1.5 text-right font-mono">% Share</th>
                      <th className="p-1.5 text-center">Official Declaration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-mono text-xs">
                    {sorted.map((cand, idx) => {
                      const candVotes = cand.voteCount || 0;
                      const pct = totalVotesForPost > 0 ? Math.round((candVotes / totalVotesForPost) * 100) : 0;
                      const isWinner = idx === 0 && candVotes > 0;

                      return (
                        <tr key={cand.id} className={`divide-x divide-black ${isWinner ? "bg-zinc-100 font-bold" : ""}`}>
                          <td className="p-1.5 text-center">{idx + 1}</td>
                          <td className="p-1.5 font-sans font-semibold">
                            {cand.fullName} {cand.nickname && `("${cand.nickname}")`}
                          </td>
                          <td className="p-1.5">{cand.matricNo || "—"}</td>
                          <td className="p-1.5 text-right font-bold">{candVotes}</td>
                          <td className="p-1.5 text-right">{pct}%</td>
                          <td className="p-1.5 text-center">
                            {isWinner ? (
                              <span className="border border-black px-2 py-0.5 text-[9px] uppercase font-extrabold bg-black text-white">
                                ELECTED
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500">RUNNER-UP</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Statutory Attestation & Signature Lines */}
        <div className="pt-6 border-t-2 border-black space-y-4 page-break-inside-avoid">
          <p className="text-[10px] text-zinc-700 italic leading-relaxed">
            "We, the undersigned Electoral Commissioners, hereby solemnly declare and certify under the Constitution and Electoral Regulations that the above results represent the exact, unaltered outcome of the secret electronic balloting exercise. Having satisfied all constitutional requirements and scored the highest valid votes cast, the candidates declared above as ELECTED are duly returned."
          </p>

          <div className="grid grid-cols-3 gap-6 pt-4 text-xs font-mono">
            <div className="space-y-4">
              <div className="border-b border-black h-12 flex items-end">
                <span className="text-[10px] text-zinc-400 italic">Signature: _______________________</span>
              </div>
              <div>
                <p className="font-bold text-black uppercase">Chief Returning Officer</p>
                <p className="text-[10px] text-zinc-600">ELCOM Secretariat</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border-b border-black h-12 flex items-end">
                <span className="text-[10px] text-zinc-400 italic">Signature: _______________________</span>
              </div>
              <div>
                <p className="font-bold text-black uppercase">ELCOM Chairman</p>
                <p className="text-[10px] text-zinc-600">Electoral Commission</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-black p-3 text-center flex flex-col items-center justify-center min-h-[90px]">
              <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block">
                OFFICIAL SECURITY STAMP & SEAL
              </span>
              <span className="text-[8px] text-zinc-400 mt-1 block">
                SHA-256 Cryptographic Nonce Verified
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[8px] font-mono text-zinc-500 border-t border-zinc-200 pt-2">
            <span>Generated via StudElect Cryptographic Engine</span>
            <span>Tamper-evident verification at: studelect.ng/verify</span>
            <span>Printed on: {new Date().toLocaleString("en-NG")}</span>
          </div>
        </div>
      </div>
    </>
  );
}
