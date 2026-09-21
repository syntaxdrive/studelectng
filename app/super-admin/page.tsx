"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  createInstitutionAction,
  updateInstitutionAction,
  deleteInstitutionAction,
  revokeCommissionerAction,
  createCommissionerAction,
  resetCommissionerPasswordAction,
  createOrganizationAction,
  getSuperAdminTelemetryAction,
  getSuperAdminCampusesAction,
  getSuperAdminCommissionersAction,
  getSuperAdminOrgLicensesAction,
  toggleOrgActivationAction,
  updateOrgLicenseAction,
  extendOrgQuotaAction,
  resetOrgBallotsAction,
  deleteWholeOrganizationAction,
  assignCommissionerOrgAction,
  restoreCampusesAction,
  getPartnerPerksAction,
  savePartnerPerkAction,
  deletePartnerPerkAction,
  togglePartnerPerkStatusAction,
  SuperAdminTelemetry,
  SuperAdminCampus,
  SuperAdminCommissioner,
  SuperAdminOrgLicense,
} from "@/app/actions/super-admin";
import { PartnerPerk, PerkPlacement, PerkMediaType } from "@/lib/perks";
import { logoutAction } from "@/app/actions/auth";
import {
  Building2,
  Vote,
  Users,
  Plus,
  ArrowRight,
  ShieldCheck,
  Activity,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Key,
  Trash2,
  Edit2,
  X,
  RefreshCw,
  ExternalLink,
  UserPlus,
  Lock,
  MessageSquare,
  Zap,
  Sliders,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Mail,
  Copy,
  Sparkles,
  Gift,
  Video,
  Image as ImageIcon,
} from "lucide-react";

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<"ORGANIZATIONS" | "CAMPUSES" | "COMMISSIONERS" | "PERKS">("ORGANIZATIONS");
  const [campuses, setCampuses] = useState<SuperAdminCampus[]>([]);
  const [commissioners, setCommissioners] = useState<SuperAdminCommissioner[]>([]);
  const [orgLicenses, setOrgLicenses] = useState<SuperAdminOrgLicense[]>([]);
  const [telemetry, setTelemetry] = useState<SuperAdminTelemetry>({
    totalInstitutions: 0,
    totalActiveElections: 0,
    totalRegisteredStudents: 0,
    totalBallotsCast: 0,
    systemHealth: "OPTIMAL",
    activeCommissionersCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampusFilter, setSelectedCampusFilter] = useState("ALL");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Edit Org License Modal State
  const [editingOrg, setEditingOrg] = useState<SuperAdminOrgLicense | null>(null);
  const [isEditingOrgModalOpen, setIsEditingOrgModalOpen] = useState(false);
  const [orgFormData, setOrgFormData] = useState<Partial<SuperAdminOrgLicense>>({});

  // Delete Org Confirmation Modal State
  const [orgToDelete, setOrgToDelete] = useState<SuperAdminOrgLicense | null>(null);
  const [isDeleteOrgModalOpen, setIsDeleteOrgModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  // Campus Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCampus, setEditingCampus] = useState<SuperAdminCampus | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campus Form Fields
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    slug: "",
    tagline: "",
    logoUrl: "",
    coverImageUrl: "",
  });

  // New Organization Modal States
  const [isAddOrgModalOpen, setIsAddOrgModalOpen] = useState(false);
  const [newOrgFormData, setNewOrgFormData] = useState({
    institutionId: "",
    name: "",
    code: "",
    slug: "",
    orgType: "DEPARTMENT" as "DEPARTMENT" | "FACULTY" | "SUG" | "HALL",
    voterQuota: 1000,
  });

  // Commissioner Modal States
  const [isAddComModalOpen, setIsAddComModalOpen] = useState(false);
  const [comFormData, setComFormData] = useState({
    fullName: "",
    email: "",
    institutionId: "",
    orgId: "ALL",
    password: "",
    role: "ELCOM_CHAIRMAN",
  });

  // ── Partner Perks & Sponsor Campaigns State ────────────────────────────────
  const [perks, setPerks] = useState<PartnerPerk[]>([]);
  const [isPerkModalOpen, setIsPerkModalOpen] = useState(false);
  const [editingPerk, setEditingPerk] = useState<PartnerPerk | null>(null);
  const [isPerkSaving, setIsPerkSaving] = useState(false);
  const [perkToDelete, setPerkToDelete] = useState<PartnerPerk | null>(null);
  const [isDeletePerkModalOpen, setIsDeletePerkModalOpen] = useState(false);
  const [perkSearchQuery, setPerkSearchQuery] = useState("");

  const defaultPerkForm: Partial<PartnerPerk> = {
    title: "",
    badge: "Exclusive Student Perk",
    sponsorName: "",
    sponsorLogoUrl: "",
    description: "",
    mediaType: "NONE",
    mediaUrl: "",
    ctaText: "Claim Student Perk →",
    ctaUrl: "",
    placements: ["POST_VOTE_RECEIPT"],
    targetInstitutions: ["ALL"],
    active: true,
    priority: 1,
  };

  const [perkFormData, setPerkFormData] = useState<Partial<PartnerPerk>>(defaultPerkForm);

  // Assign Org to Commissioner Modal State
  const [assigningCom, setAssigningCom] = useState<SuperAdminCommissioner | null>(null);
  const [isAssignComModalOpen, setIsAssignComModalOpen] = useState(false);
  const [selectedComOrgId, setSelectedComOrgId] = useState("");

  // Password reveal state for commissioners table
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const togglePasswordReveal = (comId: string) => {
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      next.has(comId) ? next.delete(comId) : next.add(comId);
      return next;
    });
  };

  // Copy text to clipboard helper
  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch (_) {}
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stats, campusList, comList, orgList, perksRes] = await Promise.all([
        getSuperAdminTelemetryAction(),
        getSuperAdminCampusesAction(),
        getSuperAdminCommissionersAction(),
        getSuperAdminOrgLicensesAction(),
        getPartnerPerksAction({ activeOnly: false }),
      ]);
      setTelemetry(stats);
      setCampuses(campusList);
      setCommissioners(comList);
      setOrgLicenses(orgList);
      if (perksRes.success) setPerks(perksRes.perks);
      if (campusList.length > 0 && !comFormData.institutionId) {
        setComFormData((prev) => ({ ...prev, institutionId: campusList[0].id }));
        setNewOrgFormData((prev) => ({ ...prev, institutionId: campusList[0].id }));
      }
    } catch (err) {
      console.warn("Failed to load SuperAdmin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddPerk = () => {
    setEditingPerk(null);
    setPerkFormData({
      ...defaultPerkForm,
      priority: perks.length + 1,
    });
    setIsPerkModalOpen(true);
  };

  const handleOpenEditPerk = (p: PartnerPerk) => {
    setEditingPerk(p);
    setPerkFormData({ ...p });
    setIsPerkModalOpen(true);
  };

  const handleSavePerk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perkFormData.title?.trim() || !perkFormData.sponsorName?.trim()) {
      alert("Please provide both Campaign Title and Sponsor Name.");
      return;
    }
    setIsPerkSaving(true);
    try {
      const res = await savePartnerPerkAction({
        ...(editingPerk ? { id: editingPerk.id } : {}),
        title: perkFormData.title.trim(),
        sponsorName: perkFormData.sponsorName.trim(),
        badge: perkFormData.badge?.trim() || "Exclusive Student Perk",
        description: perkFormData.description?.trim() || "",
        sponsorLogoUrl: perkFormData.sponsorLogoUrl?.trim() || undefined,
        mediaType: perkFormData.mediaType || "NONE",
        mediaUrl: perkFormData.mediaUrl?.trim() || undefined,
        ctaText: perkFormData.ctaText?.trim() || "Claim Student Perk →",
        ctaUrl: perkFormData.ctaUrl?.trim() || "#",
        placements: perkFormData.placements && perkFormData.placements.length > 0 ? perkFormData.placements : ["POST_VOTE_RECEIPT"],
        targetInstitutions: perkFormData.targetInstitutions && perkFormData.targetInstitutions.length > 0 ? perkFormData.targetInstitutions : ["ALL"],
        active: perkFormData.active !== false,
        priority: Number(perkFormData.priority) || 1,
      });

      if (res.success) {
        setIsPerkModalOpen(false);
        setStatusMessage(res.message);
        setTimeout(() => setStatusMessage(null), 4000);
        await loadData();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || "Failed to save perk.");
    } finally {
      setIsPerkSaving(false);
    }
  };

  const handleTogglePerkActive = async (perkId: string, currentActive: boolean) => {
    setPerks((prev) =>
      prev.map((p) => (p.id === perkId ? { ...p, active: !currentActive } : p))
    );
    const res = await togglePartnerPerkStatusAction(perkId, !currentActive);
    if (res.success) {
      setStatusMessage(res.message);
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      await loadData();
    }
  };

  const handleDeletePerk = async () => {
    if (!perkToDelete) return;
    setIsPerkSaving(true);
    try {
      const res = await deletePartnerPerkAction(perkToDelete.id);
      if (res.success) {
        setStatusMessage(res.message);
        setTimeout(() => setStatusMessage(null), 4000);
        setIsDeletePerkModalOpen(false);
        setPerkToDelete(null);
        await loadData();
      } else {
        alert(res.message);
      }
    } finally {
      setIsPerkSaving(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick Toggle Org Activation (0ms Optimistic UI)
  const handleToggleOrgActivation = async (orgId: string, currentStatus: string) => {
    const newStatusIsActive = currentStatus !== "ACTIVE";
    const nextStatus: "ACTIVE" | "PENDING_PAYMENT" = newStatusIsActive ? "ACTIVE" : "PENDING_PAYMENT";

    // 0ms Optimistic state update
    setOrgLicenses((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, licenseStatus: nextStatus } : o))
    );

    const res = await toggleOrgActivationAction(orgId, newStatusIsActive);
    if (res.success) {
      setStatusMessage(res.message || "Status updated.");
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setOrgLicenses((prev) =>
        prev.map((o) => (o.id === orgId ? { ...o, licenseStatus: currentStatus as any } : o))
      );
      setStatusMessage(res.message || "Failed to update status.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Quick Extend Quota (+250 / +500) (0ms Optimistic UI)
  const handleExtendQuota = async (orgId: string, amount: number) => {
    // 0ms Optimistic state update
    setOrgLicenses((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, voterQuota: (o.voterQuota || 0) + amount } : o))
    );
    setStatusMessage(`Quota expanded by +${amount} voters.`);

    const res = await extendOrgQuotaAction(orgId, amount);
    if (res.success) {
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Reset Mock Test Ballots
  const handleResetOrgBallots = async (instSlug: string, orgSlug: string, orgName: string) => {
    if (!confirm(`Are you sure you want to wipe all test/mock ballots for ${orgName}? This will reset vote counts to 0 for official polling.`)) {
      return;
    }
    const res = await resetOrgBallotsAction(instSlug, orgSlug);
    if (res.success) {
      setStatusMessage(res.message || "Test ballots cleared.");
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Open Delete Org Confirmation Modal
  const handleOpenDeleteOrgModal = (org: SuperAdminOrgLicense) => {
    setOrgToDelete(org);
    setDeleteConfirmInput("");
    setIsDeleteOrgModalOpen(true);
  };

  // Confirm Permanently Delete Whole Organization & Associated Users
  const handleConfirmDeleteOrg = async () => {
    if (!orgToDelete || deleteConfirmInput.trim() !== "DELETE") return;

    const targetOrg = orgToDelete;
    setIsDeletingOrg(true);
    setStatusMessage(`Deleting organization "${targetOrg.orgName}" and all associated records...`);

    // Immediate optimistic removal from current state
    setOrgLicenses((prev) => prev.filter((o) => o.id !== targetOrg.id));
    setIsDeleteOrgModalOpen(false);

    try {
      const res = await deleteWholeOrganizationAction(
        targetOrg.id,
        targetOrg.institutionSlug,
        targetOrg.orgSlug,
        targetOrg.orgName
      );

      if (res && res.success) {
        setStatusMessage(res.message || `Deleted organization "${targetOrg.orgName}".`);
      } else {
        setStatusMessage(res?.message || "Failed to delete organization.");
      }
      await loadData();
    } catch (err: any) {
      console.error("Error deleting organization:", err);
      setStatusMessage(`Error: ${err?.message || "Failed to delete organization."}`);
      await loadData();
    } finally {
      setIsDeletingOrg(false);
      setOrgToDelete(null);
      setDeleteConfirmInput("");
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  // Open Edit Org Modal
  const handleOpenEditOrg = (org: SuperAdminOrgLicense) => {
    setEditingOrg(org);
    setOrgFormData({
      ...org,
    });
    setIsEditingOrgModalOpen(true);
  };

  // Save Org License Edits (0ms Optimistic UI)
  const handleSaveOrgLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    setIsSubmitting(true);

    const updatedLicense: SuperAdminOrgLicense = {
      ...editingOrg,
      licenseStatus: (orgFormData.licenseStatus as any) || editingOrg.licenseStatus,
      voterQuota: Number(orgFormData.voterQuota) || editingOrg.voterQuota,
      agreedAmountNgn: Number(orgFormData.agreedAmountNgn) || editingOrg.agreedAmountNgn,
      paymentProofNote: orgFormData.paymentProofNote || editingOrg.paymentProofNote,
      contactAdminName: orgFormData.contactAdminName || editingOrg.contactAdminName,
      contactAdminPhone: orgFormData.contactAdminPhone || editingOrg.contactAdminPhone,
    };

    // 0ms Optimistic update and instant modal close!
    setOrgLicenses((prev) =>
      prev.map((o) => (o.id === editingOrg.id ? updatedLicense : o))
    );
    setIsEditingOrgModalOpen(false);
    setStatusMessage(`Saved quota: ${updatedLicense.voterQuota} voters (${updatedLicense.licenseStatus}).`);

    const res = await updateOrgLicenseAction(updatedLicense);
    setIsSubmitting(false);

    if (res.success) {
      // Reload from server to confirm persisted value (avoids stale cache)
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    } else {
      setStatusMessage(res.message || "Save failed — please try again.");
      // Revert optimistic update if server failed
      setOrgLicenses((prev) =>
        prev.map((o) => (o.id === editingOrg.id ? editingOrg : o))
      );
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Open Assign Commissioner Modal
  const handleOpenAssignComModal = (com: SuperAdminCommissioner) => {
    setAssigningCom(com);
    setSelectedComOrgId(com.organizationId || (orgLicenses[0]?.id || ""));
    setIsAssignComModalOpen(true);
  };

  // Save Commissioner Org Assignment (0ms Optimistic UI)
  const handleSaveComAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningCom || !selectedComOrgId) return;

    const chosenOrg = orgLicenses.find((o) => o.id === selectedComOrgId) || {
      id: selectedComOrgId,
      orgName: "Selected Organization",
    };

    // 0ms Optimistic update!
    setCommissioners((prev) =>
      prev.map((c) =>
        c.id === assigningCom.id
          ? { ...c, organization: chosenOrg.orgName, organizationId: chosenOrg.id }
          : c
      )
    );
    setIsAssignComModalOpen(false);
    setStatusMessage(`Assigned ${assigningCom.name} to ${chosenOrg.orgName}.`);

    const res = await assignCommissionerOrgAction({
      commissionerEmail: assigningCom.email,
      orgId: chosenOrg.id,
      orgName: chosenOrg.orgName,
      institutionId: assigningCom.institutionId,
    });

    if (res.success) {
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Campus Form Handling
  const handleOpenAddModal = () => {
    setEditingCampus(null);
    setFormData({ name: "", code: "", slug: "", tagline: "", logoUrl: "", coverImageUrl: "" });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (campus: SuperAdminCampus) => {
    setEditingCampus(campus);
    setFormData({
      name: campus.name,
      code: campus.code,
      slug: campus.slug,
      tagline: campus.tagline,
      logoUrl: campus.logoUrl || "",
      coverImageUrl: campus.coverImageUrl || "",
    });
    setIsAddModalOpen(true);
  };

  const handleSaveCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (editingCampus) {
      const res = await updateInstitutionAction({ id: editingCampus.id, ...formData });
      setIsSubmitting(false);
      if (res.success) {
        setIsAddModalOpen(false);
        setStatusMessage(res.message || "Campus updated.");
        await loadData();
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } else {
      const res = await createInstitutionAction(formData);
      setIsSubmitting(false);
      if (res.success) {
        setIsAddModalOpen(false);
        setStatusMessage(res.message || "Campus provisioned.");
        await loadData();
        setTimeout(() => setStatusMessage(null), 4000);
      }
    }
  };

  const handleDeleteCampus = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This will remove all associated election data.`)) {
      return;
    }
    const res = await deleteInstitutionAction(id);
    if (res.success) {
      setStatusMessage(res.message || "Campus deleted.");
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Organization Form Handling
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await createOrganizationAction(newOrgFormData);
    setIsSubmitting(false);
    if (res.success) {
      setIsAddOrgModalOpen(false);
      setNewOrgFormData({
        institutionId: campuses[0]?.id || "",
        name: "",
        code: "",
        slug: "",
        orgType: "DEPARTMENT",
        voterQuota: 1000,
      });
      setStatusMessage(res.message || "Organization provisioned.");
      await loadData();
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Commissioner Form Handling
  const handleCreateCommissioner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await createCommissionerAction(comFormData);
    setIsSubmitting(false);
    if (res.success) {
      setIsAddComModalOpen(false);
      setStatusMessage(res.message || "Commissioner created.");
      await loadData();
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleRevokeCommissioner = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this commissioner's credentials?")) return;
    const res = await revokeCommissionerAction(id);
    if (res.success) {
      setStatusMessage(res.message || "Commissioner revoked.");
      await loadData();
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleResetCommissionerPassword = async (com: SuperAdminCommissioner) => {
    const newPwd = prompt(`Set a new password for ${com.name} (${com.email}):`, "");
    if (!newPwd || !newPwd.trim()) return;
    const res = await resetCommissionerPasswordAction(com.email, newPwd.trim());
    if (res.success) {
      setStatusMessage(`Password reset for ${com.email}. New password: ${res.newPassword}`);
      await loadData();
      setTimeout(() => setStatusMessage(null), 8000);
    } else {
      setStatusMessage(res.message || "Reset failed.");
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Filtered lists
  const filteredOrgs = orgLicenses.filter((org) => {
    const matchSearch =
      org.orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.institutionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.orgSlug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCampus =
      selectedCampusFilter === "ALL" || org.institutionSlug === selectedCampusFilter;
    return matchSearch && matchCampus;
  });

  const filteredCampuses = campuses.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getWhatsAppDealLink = (org: SuperAdminOrgLicense) => {
    const phone = org.contactAdminPhone || "2348000000000";
    const text = `Hello ${org.contactAdminName || "ELCOM Chairman"}, regarding your ${org.orgName} election at ${org.institutionName} on StudElect: Your quota is currently set to ${org.voterQuota} voters (Status: ${org.licenseStatus}). Let us know if you need quota adjustments or technical clearance.`;
    return `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-8 py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="border-b border-zinc-200 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/studelect-mark.svg"
            alt="StudElect"
            className="w-10 h-10 object-contain rounded-lg shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-900 text-white uppercase">
                SUPER ADMIN
              </span>
              <span className="text-xs text-zinc-500">StudElect Platform Command Center</span>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">Platform Operations & Licensing</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <a
            href="https://wa.me/2349164221215"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            title="SuperAdmin WhatsApp Line: 09164221215"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>WA: 09164221215</span>
          </a>

          <Link
            href="/pricing"
            target="_blank"
            className="px-3.5 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span>View Public Pricing</span>
          </Link>

          <button
            type="button"
            onClick={() => logoutAction()}
            className="px-3.5 py-2 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-lg bg-zinc-900 text-white text-xs flex items-center justify-between shadow-xs">
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Telemetry Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Provisioned Campuses
          </span>
          <p className="text-2xl font-bold text-zinc-900 font-mono">{telemetry.totalInstitutions}</p>
          <span className="text-[10px] text-zinc-500">Universities & Colleges</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Active Organizations
          </span>
          <p className="text-2xl font-bold text-zinc-900 font-mono">{orgLicenses.length}</p>
          <span className="text-[10px] text-emerald-700 font-semibold">
            {orgLicenses.filter((o) => o.licenseStatus === "ACTIVE").length} Live / Cleared
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Total Registered Voters
          </span>
          <p className="text-2xl font-bold text-zinc-900 font-mono">
            {telemetry.totalRegisteredStudents.toLocaleString()}
          </p>
          <span className="text-[10px] text-zinc-500">Across all institutions</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Verified Ballots Cast
          </span>
          <p className="text-2xl font-bold text-zinc-900 font-mono">
            {telemetry.totalBallotsCast.toLocaleString()}
          </p>
          <span className="text-[10px] text-blue-600 font-semibold">100% Cryptographic Seal</span>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("ORGANIZATIONS")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            activeTab === "ORGANIZATIONS"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Organization Licenses & Quotas ({orgLicenses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CAMPUSES")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            activeTab === "CAMPUSES"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Campuses & Tenants ({campuses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COMMISSIONERS")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            activeTab === "COMMISSIONERS"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Commissioners & Admins ({commissioners.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PERKS")}
          className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
            activeTab === "PERKS"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
          <span>Student Perks & Sponsors ({perks.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ORGANIZATION LICENSES & VOTER QUOTAS */}
      {/* ========================================================================= */}
      {activeTab === "ORGANIZATIONS" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Student Organizations & Licensing Desk</h2>
              <p className="text-xs text-zinc-500">
                Flip activation toggles, adjust voter capacities, record bank transfers, and communicate directly with ELCOMs on WhatsApp.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddOrgModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Provision Organization</span>
              </button>

              {/* Campus Filter */}
              <select
                value={selectedCampusFilter}
                onChange={(e) => setSelectedCampusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 text-xs bg-white font-medium"
              >
                <option value="ALL">All Campuses</option>
                {campuses.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search orgs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-1.5 rounded-lg border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredOrgs.map((org) => {
              const registered = org.registeredVotersCount || 0;
              const quota = org.voterQuota || 500;
              const percentUsed = Math.min(100, Math.round((registered / quota) * 100));

              return (
                <div
                  key={org.id}
                  className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-4 hover:border-zinc-300 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                          {org.institutionSlug.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-900 text-white">
                          {org.orgType}
                        </span>
                        <span className="text-xs font-semibold text-zinc-500">
                          {org.institutionName}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-zinc-900">{org.orgName}</h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 pt-0.5">
                        <span>
                          Contact: <strong>{org.contactAdminName || "ELCOM"}</strong>
                        </span>
                        {org.paymentProofNote && (
                          <span className="text-zinc-600 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200 font-mono text-[11px]">
                            {org.paymentProofNote}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Controls & Quota */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Quota Gauge */}
                      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 min-w-[200px] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500 font-medium">Voter Capacity:</span>
                          <span className="font-bold font-mono text-zinc-900">
                            {registered} / {quota} voters
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percentUsed > 90 ? "bg-rose-500" : percentUsed > 70 ? "bg-amber-500" : "bg-zinc-900"
                            }`}
                            style={{ width: `${percentUsed}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span>{percentUsed}% capacity utilized</span>
                          <button
                            type="button"
                            onClick={() => handleExtendQuota(org.id, 500)}
                            className="text-blue-600 font-bold hover:underline"
                            title="Quickly add +500 voter capacity"
                          >
                            +500 Bump
                          </button>
                        </div>
                      </div>

                      {/* Payment Status & Election Lock Switch */}
                      <div className="flex flex-col items-end gap-1.5 min-w-[210px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-zinc-500">
                            {org.licenseStatus === "ACTIVE" ? "Payment Cleared:" : "Payment Pending:"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleOrgActivation(org.id, org.licenseStatus)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              org.licenseStatus === "ACTIVE" ? "bg-emerald-600" : "bg-zinc-300"
                            }`}
                            title={
                              org.licenseStatus === "ACTIVE"
                                ? "Click to Halt Election (Require Payment)"
                                : "Click to Clear Payment & Resume Election"
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                org.licenseStatus === "ACTIVE" ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 border ${
                              org.licenseStatus === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : "bg-amber-50 text-amber-900 border-amber-300"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                org.licenseStatus === "ACTIVE" ? "bg-emerald-600" : "bg-amber-600 animate-pulse"
                              }`}
                            />
                            <span>{org.licenseStatus === "ACTIVE" ? "ACTIVE • POLLS LIVE" : "HALTED • UNPAID"}</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-zinc-700">
                            ₦{org.agreedAmountNgn?.toLocaleString() || "15,000"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={getWhatsAppDealLink(org)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat on WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleOpenEditOrg(org)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3 text-zinc-500" />
                        <span>Edit Quota & Terms</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetOrgBallots(org.institutionSlug, org.orgSlug, org.orgName)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-rose-50 hover:text-rose-700 text-zinc-600 text-xs transition flex items-center gap-1"
                        title="Clear test/mock votes before election day"
                      >
                        <Trash2 className="w-3 h-3 text-zinc-400" />
                        <span>Wipe Test Ballots</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDeleteOrgModal(org)}
                        className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Permanently delete this organization, all its elections, student voter accounts, and commissioner accounts"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete Org & Users</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Link
                        href={`/${org.institutionSlug}/${org.orgSlug}`}
                        target="_blank"
                        className="text-zinc-500 hover:text-zinc-900 font-semibold flex items-center gap-1"
                      >
                        <span>Voter Booth</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>

                      <span className="text-zinc-300">•</span>

                      <Link
                        href={`/${org.institutionSlug}/admin`}
                        target="_blank"
                        className="text-zinc-500 hover:text-zinc-900 font-semibold flex items-center gap-1"
                      >
                        <span>ELCOM Panel</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CAMPUSES & TENANTS */}
      {/* ========================================================================= */}
      {activeTab === "CAMPUSES" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Registered University Campuses</h2>
              <p className="text-xs text-zinc-500">
                Manage institution tenants, update campus logos, taglines, and view live voter rosters.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Provision New Campus</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampuses.map((campus) => (
              <div
                key={campus.id}
                className="rounded-2xl bg-white border border-zinc-200 shadow-xs flex flex-col justify-between overflow-hidden hover:border-zinc-300 transition group"
              >
                <div>
                  {/* Campus Cover Image Banner */}
                  <div className="h-28 w-full relative bg-zinc-900 overflow-hidden">
                    <img
                      src={campus.coverImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80"}
                      alt={`${campus.name} Cover`}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.target as any).src = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80";
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute top-2.5 right-2.5">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs border border-white/20">
                        {campus.code}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 pt-0 relative space-y-2">
                    {/* DP Crest overlaid on banner */}
                    <div className="-mt-7 mb-2 flex items-end justify-between">
                      <div className="w-14 h-14 rounded-xl bg-white border-2 border-white shadow-md p-1.5 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img
                          src={campus.logoUrl || `/logos/${campus.slug}.svg`}
                          alt={campus.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as any).src = `/logos/${campus.slug}.svg`;
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">/{campus.slug}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-zinc-900">{campus.name}</h3>
                      <p className="text-xs text-zinc-500 italic line-clamp-2 mt-0.5">{campus.tagline}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(campus)}
                      className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 text-zinc-600 transition"
                      title="Edit Campus Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCampus(campus.id, campus.name)}
                      className="p-1.5 rounded-md border border-zinc-200 hover:bg-rose-50 hover:text-rose-600 text-zinc-600 transition"
                      title="Delete Campus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Link
                    href={`/${campus.slug}/admin`}
                    target="_blank"
                    className="text-xs text-zinc-800 hover:underline font-bold flex items-center gap-1"
                  >
                    <span>Campus Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COMMISSIONERS */}
      {/* ========================================================================= */}
      {activeTab === "COMMISSIONERS" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900">Electoral Commissioners (ELCOM)</h2>
              <p className="text-xs text-zinc-500">
                Provision commissioner access keys and manage administrative privileges.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddComModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Provision Commissioner</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[780px]">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[11px] uppercase tracking-wider text-zinc-500 font-mono">
                <tr>
                  <th className="px-4 py-3">Commissioner</th>
                  <th className="px-4 py-3">Campus</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Password</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {commissioners.map((com) => {
                  const isRevealed = revealedPasswords.has(com.id);
                  const hasPassword = !!com.plainPassword;

                  // Build pre-written email
                  const adminUrl = `https://studelect.com.ng/${(com.institutionId || "ui").replace("inst-", "")}/admin`;
                  const emailSubject = encodeURIComponent(`StudElect – Your ELCOM Admin Access (${com.organization || ""})`);
                  const emailBody = encodeURIComponent(
                    `Hello ${com.name},\n\nYour Electoral Commissioner (ELCOM) admin account has been set up on StudElect.\n\n` +
                    `Organisation: ${com.organization || "Your Organisation"}\n` +
                    `Login URL: ${adminUrl}\n` +
                    `Email: ${com.email}\n` +
                    `Password: ${com.plainPassword || "(contact superadmin for password)"}\n\n` +
                    `Please log in and change your password after first login.\n\n` +
                    `If you have any questions, reply to this email or contact the SuperAdmin.\n\n` +
                    `– StudElect Platform`
                  );
                  const mailtoLink = `mailto:${com.email}?subject=${emailSubject}&body=${emailBody}`;

                  return (
                    <tr key={com.id} className="hover:bg-zinc-50/50 transition">
                      <td className="px-4 py-3">
                        <span className="font-bold text-zinc-900 block">{com.name}</span>
                        <span className="text-zinc-500 font-mono text-[11px]">{com.email}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-700">{com.institution}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-zinc-800 block">{com.organization || "All Campus Elections"}</span>
                        {com.organizationId && (
                          <span className="text-zinc-400 font-mono text-[10px]">{com.organizationId}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">{com.role}</td>

                      {/* Password column */}
                      <td className="px-4 py-3">
                        {hasPassword ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-zinc-800 select-all">
                              {isRevealed ? com.plainPassword : "••••••••"}
                            </span>
                            <button
                              type="button"
                              title={isRevealed ? "Hide password" : "Reveal password"}
                              onClick={() => togglePasswordReveal(com.id)}
                              className="p-0.5 text-zinc-400 hover:text-zinc-700 transition"
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            {isRevealed && (
                              <button
                                type="button"
                                title="Copy password"
                                onClick={() => copyToClipboard(com.plainPassword!)}
                                className="p-0.5 text-zinc-400 hover:text-zinc-700 transition"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px] italic">Not stored</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            com.active ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800"
                          }`}
                        >
                          {com.active ? "Active" : "Revoked"}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Pre-written Email button */}
                          <a
                            href={mailtoLink}
                            title={`Send credentials email to ${com.email}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-[11px] transition"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Email</span>
                          </a>

                          {com.active && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenAssignComModal(com)}
                                className="text-zinc-800 hover:text-zinc-950 font-bold hover:underline text-[11px]"
                              >
                                Assign Org
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResetCommissionerPassword(com)}
                                className="text-amber-600 hover:text-amber-800 font-bold text-[11px]"
                                title="Set a new password for this admin"
                              >
                                Reset Pwd
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeCommissioner(com.id)}
                                className="text-rose-600 hover:text-rose-800 font-bold text-[11px]"
                              >
                                Revoke
                              </button>
                            </>
                          )}
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

      {/* ========================================================================= */}
      {/* TAB 4: STUDENT PERKS & SPONSOR CAMPAIGNS                                  */}
      {/* ========================================================================= */}
      {activeTab === "PERKS" && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header & New Campaign Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">
                  MONETIZATION & CAMPUS PERKS
                </span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mt-1">
                Student Perks, Campus Rewards & Sponsor Campaigns
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Curate non-disruptive, high-value partner rewards shown to students on vote receipts and registration slips.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddPerk}
              className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Sponsor Perk</span>
            </button>
          </div>

          {/* Performance Analytics Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase text-zinc-400">Total Campaigns</span>
              <p className="text-xl font-bold text-zinc-900">{perks.length}</p>
              <p className="text-[10px] text-zinc-500">{perks.filter((p) => p.active).length} active right now</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase text-zinc-400">Student Impressions</span>
              <p className="text-xl font-bold text-zinc-900">
                {perks.reduce((acc, p) => acc + (p.impressionsCount || 0), 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-500">Verified post-action views</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase text-zinc-400">Student Clicks</span>
              <p className="text-xl font-bold text-emerald-600">
                {perks.reduce((acc, p) => acc + (p.clicksCount || 0), 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-zinc-500">Engaged outbound leads</p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 space-y-1 shadow-2xs">
              <span className="text-[10px] font-mono font-bold uppercase text-zinc-400">Avg. Click-Through Rate</span>
              <p className="text-xl font-bold text-indigo-600">
                {(() => {
                  const totalImp = perks.reduce((acc, p) => acc + (p.impressionsCount || 0), 0);
                  const totalClk = perks.reduce((acc, p) => acc + (p.clicksCount || 0), 0);
                  return totalImp > 0 ? `${((totalClk / totalImp) * 100).toFixed(1)}%` : "0.0%";
                })()}
              </p>
              <p className="text-[10px] text-zinc-500">High-intent student conversion</p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search perk campaigns by sponsor or title..."
                value={perkSearchQuery}
                onChange={(e) => setPerkSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <div className="text-[11px] text-zinc-500">
              Showing {perks.filter(p => !perkSearchQuery || p.title.toLowerCase().includes(perkSearchQuery.toLowerCase()) || p.sponsorName.toLowerCase().includes(perkSearchQuery.toLowerCase())).length} campaigns
            </div>
          </div>

          {/* Campaigns Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {perks
              .filter(
                (p) =>
                  !perkSearchQuery ||
                  p.title.toLowerCase().includes(perkSearchQuery.toLowerCase()) ||
                  p.sponsorName.toLowerCase().includes(perkSearchQuery.toLowerCase())
              )
              .map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl bg-white border border-zinc-200 shadow-2xs hover:shadow-xs transition p-4 space-y-3.5 text-xs flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Sponsor, Badge, Active Switch */}
                    <div className="flex items-start justify-between gap-2 border-b border-zinc-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        {p.sponsorLogoUrl ? (
                          <img
                            src={p.sponsorLogoUrl}
                            alt={p.sponsorName}
                            className="w-7 h-7 rounded-full object-cover border border-zinc-200"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-700 text-xs">
                            {p.sponsorName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-zinc-900 leading-none">{p.sponsorName}</h4>
                          <span className="text-[10px] text-zinc-400 font-mono">Priority #{p.priority}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePerkActive(p.id, p.active)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition flex items-center gap-1 ${
                            p.active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-zinc-100 text-zinc-500 border border-zinc-200 hover:bg-zinc-200"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${p.active ? "bg-emerald-500" : "bg-zinc-400"}`} />
                          <span>{p.active ? "Active" : "Paused"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Media Thumbnail (if applicable) */}
                    {p.mediaType === "IMAGE" && p.mediaUrl && (
                      <div className="w-full h-28 rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100">
                        <img src={p.mediaUrl} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                    )}

                    {p.mediaType === "VIDEO" && p.mediaUrl && (
                      <div className="p-2.5 rounded-lg bg-zinc-900 text-white flex items-center gap-2 text-[11px]">
                        <Video className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="truncate">Video Asset: {p.mediaUrl}</span>
                      </div>
                    )}

                    {/* Title & Description */}
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200/60 mb-1">
                        {p.badge}
                      </span>
                      <h3 className="font-bold text-zinc-900 text-sm">{p.title}</h3>
                      <p className="text-zinc-600 line-clamp-2 mt-1 text-[11px]">{p.description}</p>
                    </div>

                    {/* Placements & Campuses Tag Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.placements.map((plc) => (
                        <span key={plc} className="text-[9px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                          {plc === "POST_VOTE_RECEIPT" ? "🗳️ Ballot Receipt" : plc === "PIN_REGISTRATION" ? "🔑 PIN Slip" : "🏛️ Campus Hub"}
                        </span>
                      ))}
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        📍 {p.targetInstitutions.includes("ALL") ? "All Campuses (National)" : p.targetInstitutions.join(", ").toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Analytics & Actions Bar */}
                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-3 text-zinc-500 font-mono">
                      <span>👁️ {(p.impressionsCount || 0).toLocaleString()} views</span>
                      <span>👆 {(p.clicksCount || 0).toLocaleString()} clicks</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPerk(p)}
                        className="px-2.5 py-1 rounded-md border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition flex items-center gap-1 font-semibold"
                      >
                        <Edit2 className="w-3 h-3 text-zinc-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPerkToDelete(p);
                          setIsDeletePerkModalOpen(true);
                        }}
                        className="p-1 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete perk"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT ORG LICENSE & QUOTA */}
      {/* ========================================================================= */}
      {isEditingOrgModalOpen && editingOrg && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-lg w-full p-6 space-y-6 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500">
                  {editingOrg.institutionSlug.toUpperCase()} • {editingOrg.orgSlug.toUpperCase()}
                </span>
                <h3 className="text-base font-bold text-zinc-900 mt-0.5">Edit Organization License & Quota</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingOrgModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOrgLicense} className="space-y-4">
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                  License Status
                </label>
                <select
                  value={orgFormData.licenseStatus || "ACTIVE"}
                  onChange={(e) => setOrgFormData((prev) => ({ ...prev, licenseStatus: e.target.value as any }))}
                  className="w-full px-3.5 py-2 rounded-lg border border-zinc-300 text-xs font-bold"
                >
                  <option value="ACTIVE">ACTIVE (PAID & UNLOCKED)</option>
                  <option value="PENDING_PAYMENT">PENDING PAYMENT (STANDBY)</option>
                  <option value="LOCKED">SUSPENDED / LOCKED</option>
                  <option value="CONCLUDED">CONCLUDED / ARCHIVED</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                    Voter Quota Capacity
                  </label>
                  <input
                    type="number"
                    value={orgFormData.voterQuota || 500}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, voterQuota: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2 rounded-lg border border-zinc-300 text-xs font-mono font-bold"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    {[500, 1000, 3000, 10000].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setOrgFormData((prev) => ({ ...prev, voterQuota: q }))}
                        className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-[10px] font-mono"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                    Agreed Price (₦)
                  </label>
                  <input
                    type="number"
                    value={orgFormData.agreedAmountNgn || 15000}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, agreedAmountNgn: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2 rounded-lg border border-zinc-300 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                  Payment Proof / Transfer Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid ₦30,000 via GTBank - Ref #4892"
                  value={orgFormData.paymentProofNote || ""}
                  onChange={(e) => setOrgFormData((prev) => ({ ...prev, paymentProofNote: e.target.value }))}
                  className="w-full px-3.5 py-2 rounded-lg border border-zinc-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                    Contact Admin Name
                  </label>
                  <input
                    type="text"
                    value={orgFormData.contactAdminName || ""}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, contactAdminName: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-lg border border-zinc-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                    WhatsApp Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 2348012345678"
                    value={orgFormData.contactAdminPhone || ""}
                    onChange={(e) => setOrgFormData((prev) => ({ ...prev, contactAdminPhone: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-lg border border-zinc-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsEditingOrgModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-zinc-900 text-white font-bold hover:bg-zinc-800 shadow-xs"
                >
                  {isSubmitting ? "Saving..." : "Save License Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT CAMPUS */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">
                {editingCampus ? "Edit Campus" : "Provision New Campus"}
              </h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)}>
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleSaveCampus} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Campus Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">URL Slug</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Tagline</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tagline: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Campus DP / Logo Crest
                  <span className="text-zinc-400 font-normal ml-1">(SuperAdmin exclusive)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-zinc-50 border border-zinc-200 p-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img
                      src={formData.logoUrl || (formData.slug ? `/logos/${formData.slug}.svg` : "/favicon.svg")}
                      alt="Crest Preview"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as any).src = formData.slug ? `/logos/${formData.slug}.svg` : "/favicon.svg";
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="https://... (Direct image URL or SVG)"
                      value={formData.logoUrl}
                      onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 text-xs font-mono"
                    />
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold transition">
                        <span>Upload DP File</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === "string") {
                                  setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <span className="text-[10px] text-zinc-400">or enter direct link</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Campus Cover / Banner Image
                  <span className="text-zinc-400 font-normal ml-1">(Displays on homepage & campus hub)</span>
                </label>
                <div className="space-y-2">
                  {formData.coverImageUrl && (
                    <div className="h-24 w-full rounded-lg bg-zinc-100 border border-zinc-200 overflow-hidden relative">
                      <img
                        src={formData.coverImageUrl}
                        alt="Cover Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as any).src = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80";
                        }}
                      />
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="https://... (Direct banner photo link or Unsplash image URL)"
                    value={formData.coverImageUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 text-xs font-mono"
                  />
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[11px] font-semibold transition">
                      <span>Upload Cover Banner</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === "string") {
                                setFormData((prev) => ({ ...prev, coverImageUrl: reader.result as string }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    <span className="text-[10px] text-zinc-400">JPEG/PNG/WebP high-res landscape banner</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-zinc-900 text-white font-bold rounded-lg">
                  {isSubmitting ? "Saving..." : "Save Campus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD COMMISSIONER */}
      {/* ========================================================================= */}
      {isAddComModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">Provision New Commissioner</h3>
              <button type="button" onClick={() => setIsAddComModalOpen(false)}>
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreateCommissioner} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={comFormData.fullName}
                  onChange={(e) => setComFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={comFormData.email}
                  onChange={(e) => setComFormData((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Assigned Campus</label>
                <select
                  value={comFormData.institutionId}
                  onChange={(e) => {
                    const newInst = e.target.value;
                    setComFormData((prev) => ({ ...prev, institutionId: newInst, orgId: "ALL" }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-medium"
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  Assigned Student Organization <span className="text-zinc-400 font-normal">(Scope of Authority)</span>
                </label>
                <select
                  value={comFormData.orgId}
                  onChange={(e) => setComFormData((prev) => ({ ...prev, orgId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-medium"
                >
                  <option value="ALL">All Campus Elections (Apex / Central Commission)</option>
                  {orgLicenses
                    .filter((org) => {
                      const selectedCampus = campuses.find((c) => c.id === comFormData.institutionId);
                      return selectedCampus
                        ? org.institutionSlug.toLowerCase() === selectedCampus.slug.toLowerCase() ||
                          org.id.startsWith(`org-${selectedCampus.slug}`)
                        : true;
                    })
                    .map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.orgName} ({org.orgType})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Restricts this commissioner&apos;s administrative credentials to manage polling for this specific student body.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Administrative Role</label>
                  <select
                    value={comFormData.role}
                    onChange={(e) => setComFormData((prev) => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-mono"
                  >
                    <option value="ELCOM_CHAIRMAN">ELCOM Chairman</option>
                    <option value="ELCOM_SECRETARY">ELCOM Secretary</option>
                    <option value="RETURNING_OFFICER">Returning Officer</option>
                    <option value="POLLING_OFFICER">Polling Clerk</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Initial Password</label>
                  <input
                    type="text"
                    placeholder="Defaults to elcom2026"
                    value={comFormData.password}
                    onChange={(e) => setComFormData((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setIsAddComModalOpen(false)} className="px-4 py-2 border rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-zinc-900 text-white font-bold rounded-lg">
                  {isSubmitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROVISION STUDENT ORGANIZATION */}
      {/* ========================================================================= */}
      {isAddOrgModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-bold text-zinc-900">Provision New Student Organization</h3>
              <button type="button" onClick={() => setIsAddOrgModalOpen(false)}>
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreateOrganization} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">University / Campus</label>
                <select
                  value={newOrgFormData.institutionId}
                  onChange={(e) => setNewOrgFormData((prev) => ({ ...prev, institutionId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-medium"
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nigerian Economics Students' Association"
                  value={newOrgFormData.name}
                  onChange={(e) => setNewOrgFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Short Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NESA"
                    value={newOrgFormData.code}
                    onChange={(e) => setNewOrgFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">URL Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. nesa"
                    value={newOrgFormData.slug}
                    onChange={(e) => setNewOrgFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Organization Tier</label>
                  <select
                    value={newOrgFormData.orgType}
                    onChange={(e) => setNewOrgFormData((prev) => ({ ...prev, orgType: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs"
                  >
                    <option value="DEPARTMENT">Departmental Association</option>
                    <option value="FACULTY">Faculty Association</option>
                    <option value="SUG">Student Union Government (SUG)</option>
                    <option value="HALL">Hall of Residence</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Initial Voter Quota</label>
                  <input
                    type="number"
                    value={newOrgFormData.voterQuota}
                    onChange={(e) => setNewOrgFormData((prev) => ({ ...prev, voterQuota: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button type="button" onClick={() => setIsAddOrgModalOpen(false)} className="px-4 py-2 border rounded-lg text-zinc-700 hover:bg-zinc-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-zinc-900 text-white font-bold rounded-lg hover:bg-zinc-800">
                  {isSubmitting ? "Provisioning..." : "Provision Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Organization Confirmation Modal */}
      {isDeleteOrgModalOpen && orgToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-rose-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-rose-50 border-b border-rose-100 p-4 sm:p-5 flex items-start gap-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-lg shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-950">
                  Permanently Erase Organization & Users
                </h3>
                <p className="text-xs text-rose-800 mt-1">
                  This action is irreversible. All electoral data, student records, and administrator logins will be permanently wiped.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs text-zinc-600">
              <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1.5">
                <div className="flex justify-between items-center text-zinc-900 font-bold text-sm">
                  <span>{orgToDelete.orgName}</span>
                  <span className="text-xs font-mono uppercase bg-zinc-200 px-2 py-0.5 rounded text-zinc-700">
                    {orgToDelete.orgSlug}
                  </span>
                </div>
                <p className="text-zinc-500 text-[11px]">
                  Institution: <strong className="text-zinc-800">{orgToDelete.institutionName}</strong> ({orgToDelete.institutionSlug.toUpperCase()})
                </p>
              </div>

              <div className="space-y-1.5 text-zinc-700">
                <p className="font-semibold text-zinc-900">The following records will be permanently erased:</p>
                <ul className="list-disc pl-4 space-y-1 text-zinc-600">
                  <li>Organization configuration and active license quota</li>
                  <li>All past and active elections, ballot boxes, candidate posts and nominations</li>
                  <li>All student voter accounts registered under this organization</li>
                  <li>All ELCOM commissioner accounts assigned to this organization</li>
                </ul>
              </div>

              <div className="space-y-2 pt-2">
                <label className="block font-semibold text-zinc-900">
                  To confirm deletion, type <span className="font-mono text-rose-700 font-bold">DELETE</span> below:
                </label>
                <input
                  type="text"
                  placeholder="Type DELETE to confirm"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 font-mono text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingOrg}
                onClick={() => {
                  setIsDeleteOrgModalOpen(false);
                  setOrgToDelete(null);
                  setDeleteConfirmInput("");
                }}
                className="px-4 py-2 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmInput.trim() !== "DELETE" || isDeletingOrg}
                onClick={handleConfirmDeleteOrg}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingOrg ? "Erasing Organization..." : "Confirm & Delete Everything"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Organization to Commissioner Modal */}
      {isAssignComModalOpen && assigningCom && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500">
                  {assigningCom.institution}
                </span>
                <h3 className="text-base font-bold text-zinc-900 mt-0.5">Assign Student Organization</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignComModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-1">
              <p className="font-bold text-zinc-900 text-sm">{assigningCom.name}</p>
              <p className="font-mono text-zinc-500 text-[11px]">{assigningCom.email}</p>
              <p className="text-zinc-500 text-[11px]">
                Currently Assigned: <strong className="text-zinc-800">{assigningCom.organization || "All Campus Elections"}</strong>
              </p>
            </div>

            <form onSubmit={handleSaveComAssignment} className="space-y-4">
              <div>
                <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                  Select Organization
                </label>
                <select
                  value={selectedComOrgId}
                  onChange={(e) => setSelectedComOrgId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 text-xs font-semibold bg-white"
                  required
                >
                  <option value="">-- Choose Organization --</option>
                  {orgLicenses.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.orgName} ({org.orgSlug.toUpperCase()} • {org.institutionName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAssignComModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-zinc-700 hover:bg-zinc-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedComOrgId}
                  className="px-5 py-2 bg-zinc-900 text-white font-bold rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE OR EDIT PARTNER PERK / SPONSOR CAMPAIGN                      */}
      {/* ========================================================================= */}
      {isPerkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-4xl w-full p-6 space-y-5 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-amber-600 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Campus Partner Campaign
                </span>
                <h3 className="text-base font-bold text-zinc-900 mt-0.5">
                  {editingPerk ? "Edit Student Perk / Sponsor Offer" : "Create New Student Perk / Sponsor Offer"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPerkModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Fields (7 cols) */}
              <form onSubmit={handleSavePerk} className="lg:col-span-7 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                      Sponsor / Brand Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Piggyvest, MTN, Kuda"
                      value={perkFormData.sponsorName || ""}
                      onChange={(e) => setPerkFormData((prev) => ({ ...prev, sponsorName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                      Badge Tag
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Exclusive Student Perk"
                      value={perkFormData.badge || ""}
                      onChange={(e) => setPerkFormData((prev) => ({ ...prev, badge: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                    Campaign Headline / Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Claim ₦1,000 Welcome Bonus on Your First Savings Lock"
                    value={perkFormData.title || ""}
                    onChange={(e) => setPerkFormData((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-semibold focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                    Friendly Description (Copy)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Friendly, helpful explanation of the perk or student benefit..."
                    value={perkFormData.description || ""}
                    onChange={(e) => setPerkFormData((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Media Type Selection */}
                <div className="space-y-2 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                  <label className="block font-semibold uppercase text-zinc-700 font-mono text-[11px]">
                    Media Asset Type
                  </label>
                  <div className="flex gap-2">
                    {(["NONE", "IMAGE", "VIDEO"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPerkFormData((prev) => ({ ...prev, mediaType: t }))}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1.5 ${
                          perkFormData.mediaType === t
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                        }`}
                      >
                        {t === "NONE" && <span>Text Only</span>}
                        {t === "IMAGE" && (
                          <>
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Image Banner</span>
                          </>
                        )}
                        {t === "VIDEO" && (
                          <>
                            <Video className="w-3.5 h-3.5" />
                            <span>Video Link</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>

                  {perkFormData.mediaType === "IMAGE" && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Image URL (e.g. https://...)"
                          value={perkFormData.mediaUrl || ""}
                          onChange={(e) => setPerkFormData((prev) => ({ ...prev, mediaUrl: e.target.value }))}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                        />
                        <label className="px-3 py-1.5 rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 cursor-pointer font-semibold flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === "string") {
                                  setPerkFormData((prev) => ({
                                    ...prev,
                                    mediaType: "IMAGE",
                                    mediaUrl: reader.result as string,
                                  }));
                                }
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {perkFormData.mediaType === "VIDEO" && (
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="YouTube, Vimeo, or MP4 video URL (e.g. https://youtu.be/...)"
                        value={perkFormData.mediaUrl || ""}
                        onChange={(e) => setPerkFormData((prev) => ({ ...prev, mediaUrl: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* CTA Button Label & Destination Link */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                      Call-to-Action Button Text
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Claim ₦1,000 Bonus →"
                      value={perkFormData.ctaText || ""}
                      onChange={(e) => setPerkFormData((prev) => ({ ...prev, ctaText: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs font-bold focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                      Destination Link (URL) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://sponsor.com/student-deal"
                      value={perkFormData.ctaUrl || ""}
                      onChange={(e) => setPerkFormData((prev) => ({ ...prev, ctaUrl: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Placements & Targeting */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                      Placements
                    </label>
                    <div className="space-y-1.5 text-[11px]">
                      {[
                        { id: "POST_VOTE_RECEIPT" as const, label: "Post-Vote Ballot Receipt" },
                        { id: "PIN_REGISTRATION" as const, label: "PIN Registration Slip" },
                        { id: "CAMPUS_HUB" as const, label: "Campus Results & Hub" },
                      ].map((plc) => (
                        <label key={plc.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={perkFormData.placements?.includes(plc.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPerkFormData((prev) => {
                                const curr = prev.placements || [];
                                return {
                                  ...prev,
                                  placements: checked
                                    ? [...curr, plc.id]
                                    : curr.filter((x) => x !== plc.id),
                                };
                              });
                            }}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                          />
                          <span>{plc.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold uppercase text-zinc-700 mb-1 font-mono text-[11px]">
                      Target Campuses
                    </label>
                    <select
                      value={perkFormData.targetInstitutions?.[0] || "ALL"}
                      onChange={(e) =>
                        setPerkFormData((prev) => ({
                          ...prev,
                          targetInstitutions: [e.target.value],
                        }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs"
                    >
                      <option value="ALL">All Universities (Nationwide)</option>
                      {campuses.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>

                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="perkActiveToggle"
                        checked={perkFormData.active !== false}
                        onChange={(e) => setPerkFormData((prev) => ({ ...prev, active: e.target.checked }))}
                        className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      />
                      <label htmlFor="perkActiveToggle" className="font-semibold text-zinc-800 cursor-pointer">
                        Publish Campaign Immediately (Active)
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsPerkModalOpen(false)}
                    className="px-4 py-2 border rounded-lg text-zinc-700 hover:bg-zinc-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPerkSaving}
                    className="px-5 py-2 bg-zinc-900 text-white font-bold rounded-lg hover:bg-zinc-800 transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isPerkSaving ? "Saving Campaign..." : "Save Partner Perk"}</span>
                  </button>
                </div>
              </form>

              {/* Real-Time Live Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-2 border-t lg:border-t-0 lg:border-l border-zinc-200 lg:pl-6 pt-4 lg:pt-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                  LIVE STUDENT VIEW PREVIEW
                </span>
                <p className="text-[11px] text-zinc-500">
                  How this offer appears to students on post-action screens:
                </p>

                {/* Exact Simulated Card */}
                <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-white via-zinc-50/50 to-zinc-50 p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/60 shadow-2xs">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                      <span>{perkFormData.badge || "Exclusive Student Perk"}</span>
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      By <strong className="text-zinc-800">{perkFormData.sponsorName || "Sponsor"}</strong>
                    </span>
                  </div>

                  {perkFormData.mediaType === "IMAGE" && perkFormData.mediaUrl && (
                    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 max-h-36">
                      <img
                        src={perkFormData.mediaUrl}
                        alt="Preview"
                        className="w-full h-full object-cover max-h-36"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-zinc-900 leading-snug">
                      {perkFormData.title || "Your Campaign Headline Here"}
                    </h4>
                    <p className="text-[11px] text-zinc-600 leading-relaxed line-clamp-3">
                      {perkFormData.description || "Your friendly perk description explaining the benefit..."}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-zinc-200/70 flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-400 font-mono">Zero Spam Guarantee</span>
                    <div className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[11px] font-bold shadow-xs">
                      {perkFormData.ctaText || "Claim Student Perk →"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Perk Confirmation Modal */}
      {isDeletePerkModalOpen && perkToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-rose-200 overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-rose-50 border-b border-rose-100 p-4 flex items-center gap-3">
              <div className="p-2 bg-rose-600 text-white rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950">Remove Perk Campaign</h3>
                <p className="text-[11px] text-rose-800">
                  Are you sure you want to delete this partner campaign?
                </p>
              </div>
            </div>
            <div className="p-4 space-y-3 text-xs text-zinc-600">
              <p>
                Deleting <strong>"{perkToDelete.title}"</strong> ({perkToDelete.sponsorName}) will remove it from all student post-vote screens immediately.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeletePerkModalOpen(false);
                    setPerkToDelete(null);
                  }}
                  className="px-3.5 py-1.5 border rounded-lg text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeletePerk}
                  disabled={isPerkSaving}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition"
                >
                  {isPerkSaving ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
