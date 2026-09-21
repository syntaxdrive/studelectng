"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Zap,
  ShieldCheck,
  Users,
  Building2,
  MessageSquare,
  ArrowRight,
  HelpCircle,
  BarChart3,
  FileSpreadsheet,
  Lock,
  Award,
  ChevronDown,
  Sparkles,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function PricingPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "2349164221215";

  const getWhatsAppLink = (planName: string, voters: string, price: string) => {
    const text = `*ELECTION ACTIVATION INQUIRY*\n\nHello SuperAdmin, I am an ELCOM Chairman / Student Executive.\n\nWe would like to activate the *${planName}* (${voters} at ₦${price}) for our upcoming campus election.\n\nKindly send us payment instructions and onboarding clearance.`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
  };

  const plans = [
    {
      id: "micro",
      name: "Micro Tier",
      badge: "Small Depts & Halls",
      voters: "Up to 500 Voters",
      votersCount: 500,
      priceNgn: "15,000",
      description: "Ideal for small academic departments, residential halls, and student clubs.",
      bestFor: "Best for 100–500 student departmental & hall elections",
      popular: false,
      ctaText: "Activate Micro (₦15k)",
      features: [
        { text: "Up to 500 Accredited Voters", bold: true },
        { text: "Instant ₦0 PIN Slip Generator", detail: "Zero SMS failure, zero telecom fees" },
        { text: "Unlimited Contested Offices & Candidates", detail: "With photo profiles & manifestos" },
        { text: "Blind Cryptographic Ballot Tokens", detail: "100% anonymous & tamper-evident" },
        { text: "Real-Time Multi-Color Bar Charts", detail: "Live candidate standing updates" },
        { text: "Printable QR Certificate of Return", detail: "Official accredited handover sheet" },
        { text: "Priority WhatsApp Clearance", detail: "Live activation in under 15 minutes" },
      ],
    },
    {
      id: "department",
      name: "Department Pro",
      badge: "Most Popular",
      voters: "Up to 1,000 Voters",
      votersCount: 1000,
      priceNgn: "30,000",
      description: "The gold standard for medium-to-large departmental associations (NESA, NACOS, NAMSSN).",
      bestFor: "Best for active departmental associations & large halls",
      popular: true,
      ctaText: "Activate Dept Pro (₦30k)",
      features: [
        { text: "Up to 1,000 Accredited Voters", bold: true },
        { text: "Everything in Micro Tier, PLUS:", bold: true },
        { text: "Automated Dues & Whitelist Screening", detail: "CSV/Excel import with instant matric lookup" },
        { text: "Academic Level & Disciplinary Gating", detail: "Enforce 100L–500L & good standing" },
        { text: "Scheduled Auto-Pause Election Timer", detail: "Auto-halt voting when polling time expires" },
        { text: "Demographic Doughnut Charts & Velocity", detail: "Real-time participation breakdown" },
        { text: "Sealed Results / Live Press Room Toggle", detail: "Withhold or broadcast live with 1 click" },
        { text: "Observer & Multi-Device Admin Access", detail: "Supervise polls without session conflicts" },
      ],
    },
    {
      id: "faculty",
      name: "Faculty Pro",
      badge: "Full Faculties",
      voters: "Up to 3,000 Voters",
      votersCount: 3000,
      priceNgn: "65,000",
      description: "Designed for full faculties (Science, Law, Engineering, Social Sciences) with multi-dept elections.",
      bestFor: "Best for full faculty associations & multiple departments",
      popular: false,
      ctaText: "Activate Faculty Pro (₦65k)",
      features: [
        { text: "Up to 3,000 Accredited Voters", bold: true },
        { text: "Everything in Department Pro, PLUS:", bold: true },
        { text: "Multi-Department Concurrent Ballot Engine", detail: "Host faculty + dept ballots simultaneously" },
        { text: "Bulk High-Speed Excel Ingestion", detail: "Smart fuzzy column mapper & deduplication" },
        { text: "Decentralized Sub-Commissioners", detail: "Assign department-level electoral officers" },
        { text: "Pre-Election Sandbox Mock Testing", detail: "1-click test simulation & audit reset" },
        { text: "Custom Faculty Cover & Crest Branding", detail: "Personalized institutional look" },
        { text: "SHA-256 Merkle Audit Ledger Export", detail: "Forensic election audit certificate" },
      ],
    },
    {
      id: "sug",
      name: "SUG / Apex",
      badge: "Campus-Wide",
      voters: "3,000+ / Unlimited",
      votersCount: 35000,
      priceNgn: "150,000+",
      description: "University-wide scale for apex Student Union Governments, SRCs, and multi-campus elections.",
      bestFor: "Best for university-wide SUG & multi-campus voting",
      popular: false,
      ctaText: "Contact for SUG Plan",
      features: [
        { text: "3,000+ / Unlimited Electorate Scale", bold: true },
        { text: "Everything in Faculty Pro, PLUS:", bold: true },
        { text: "Ultra-High Concurrency Cloud Cluster", detail: "Zero downtime under 10,000+ simultaneous clicks" },
        { text: "Anti-DDoS & Hostile Network Protection", detail: "Rate limiters & blind nonces" },
        { text: "Hall of Residence Decentralized Routing", detail: "Voter zoning by hall & faculty" },
        { text: "Commission Multi-Sig Approval Protocol", detail: "Multi-party consensus certification" },
        { text: "Dean of Student Affairs Observer Portal", detail: "Official university leadership dashboard" },
        { text: "Dedicated On-Call Senior Engineer", detail: "Direct standby engineer on election day" },
      ],
    },
  ];

  const allFeaturesIncluded = [
    "Unlimited Contested Offices & Candidate Profiles with Photos",
    "Treasurer Excel / CSV Dues Compliance Matcher",
    "Decoupled Blind Cryptographic Ballot Tokens (100% Anonymous)",
    "Instant ₦0 PIN Slip Generator & Self-Service Portal Lookup (Zero SMS Fees)",
    "Real-Time Multi-Color Bar Charts & Demographic Turnout Donut Charts",
    "Live Press Room & Observer SHA-256 Merkle Audit Ledger",
    "Cryptographic Single-Vote Enforcement (Zero Multiple Voting)",
    "Official Printable / Exportable Certificate of Return with QR Verification",
    "Dedicated SuperAdmin Setup & Activation in under 15 Minutes",
  ];

  const faqs = [
    {
      q: "How does payment work?",
      a: "StudElect operates on a transparent Pay-Per-Use model. When you click 'Select Plan', you are connected directly to our Platform SuperAdmin on WhatsApp. We discuss your election schedule, you make a direct bank transfer, and your organization is activated on the platform in under 15 minutes.",
    },
    {
      q: "Why is voter capacity the only difference between plans?",
      a: "We believe in zero artificial feature restrictions. Every student organization—from a 100-student department to a 30,000-student SUG—deserves the exact same military-grade cryptographic secrecy, live charts, and dues screening tools. You only pay for the server capacity required for your voter size.",
    },
    {
      q: "What happens if more students register than our plan limit?",
      a: "No problem at all. If your voter registration exceeds your initial tier (e.g. you picked 500 voters but 620 registered), you can simply message the SuperAdmin on WhatsApp to top up your quota with a quick difference payment without interrupting voting.",
    },
    {
      q: "Are there any hidden SMS or telecom charges?",
      a: "None. Competitors charge ₦4–₦6 per SMS that frequently fail due to Nigerian telco DND issues. StudElect uses instant, tamper-proof ₦0 PIN generation slips and direct self-service portal lookups, saving your association thousands of naira in SMS bills.",
    },
    {
      q: "Can we test the platform before our official election day?",
      a: "Yes. When your organization is activated, your ELCOM admin can create mock candidates and test ballot casting. The SuperAdmin can wipe test votes with a single click right before official polls open.",
    },
  ];

  return (
    <div className="space-y-16 py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-700 text-xs font-semibold shadow-xs">
          <Zap className="w-3.5 h-3.5 text-blue-600" />
          <span>Transparent Pay-Per-Use Pricing</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900">
          Simple, Fair Pricing Based Solely on Voter Size
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
          Every plan is loaded with <strong>enterprise-grade electoral features</strong>. Zero hidden SMS fees, zero surprise costs. Select your electorate tier and unlock your campus portal instantly.
        </p>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative p-6 rounded-2xl bg-white border transition flex flex-col justify-between ${
              plan.popular
                ? "border-zinc-900 shadow-xl ring-2 ring-zinc-900 bg-gradient-to-b from-zinc-50/40 to-white"
                : "border-zinc-200 shadow-xs hover:border-zinc-400 hover:shadow-md"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-zinc-900 text-white text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>{plan.badge}</span>
              </span>
            )}

            <div className="space-y-4 flex-1">
              <div>
                <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  {plan.badge}
                </span>
                <h3 className="text-xl font-bold text-zinc-900 mt-0.5">{plan.name}</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed min-h-[36px]">{plan.description}</p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-zinc-500 block">
                  ELECTORATE CAPACITY
                </span>
                <span className="text-sm font-bold text-zinc-900 block font-mono">
                  {plan.voters}
                </span>
              </div>

              <div className="pt-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-zinc-500 font-mono">₦</span>
                  <span className="text-3xl font-extrabold font-mono text-zinc-900">{plan.priceNgn}</span>
                  <span className="text-xs text-zinc-500 font-medium">/ election</span>
                </div>
                <span className="text-[11px] text-zinc-400 block mt-0.5 font-medium">One-time payment • No recurring fees</span>
              </div>

              {/* Feature Checklist inside each card */}
              <div className="pt-4 border-t border-zinc-100 space-y-2.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                  INCLUDED FEATURES:
                </span>
                <ul className="space-y-2 text-xs">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <div className="leading-snug">
                        <span className={feat.bold ? "font-bold text-zinc-900" : "font-medium text-zinc-800"}>
                          {feat.text}
                        </span>
                        {feat.detail && (
                          <span className="block text-[11px] text-zinc-500 font-normal mt-0.5">
                            {feat.detail}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-zinc-100">
              <a
                href={getWhatsAppLink(plan.name, plan.voters, `₦${plan.priceNgn}`)}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
                  plan.popular
                    ? "bg-zinc-900 hover:bg-zinc-800 text-white"
                    : "border border-zinc-300 hover:bg-zinc-100 text-zinc-800 bg-white"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{plan.ctaText}</span>
              </a>
              <span className="block text-center text-[10px] text-zinc-400 mt-2">Instant SuperAdmin clearance</span>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Matrix Notice (All Features Included for Everyone) */}
      <div className="p-8 rounded-3xl bg-zinc-900 text-white space-y-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider">
              100% UNLOCKED CAPABILITIES
            </span>
            <h2 className="text-xl sm:text-2xl font-bold mt-1">
              Included in Every Single Plan — Zero Feature Gating
            </h2>
          </div>
          <span className="px-3.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono">
            No Artificial Paywalls
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allFeaturesIncluded.map((feat, i) => (
            <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
              <div className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-blue-400" />
              </div>
              <span className="leading-relaxed">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Institutional Campus License Banner (Deans & Student Affairs) */}
      <div className="p-8 rounded-2xl bg-white border border-zinc-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-800" />
            <span className="text-xs font-mono font-bold uppercase text-zinc-500">
              INSTITUTIONAL PARTNERSHIP
            </span>
          </div>
          <h3 className="text-lg font-bold text-zinc-900">
            Dean of Student Affairs / University-Wide Annual Retainer
          </h3>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Need an annual multi-tenant deployment covering the central SUG, all 14 Faculties, 85+ Departments, and Halls of Residence with official university audit compliance? Speak with our engineering leadership.
          </p>
        </div>

        <a
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
            "Hello StudElect Support, I am inquiring on behalf of University Management / Dean of Student Affairs regarding an annual campus-wide multi-tenant license."
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-2 flex-shrink-0 shadow-xs"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Discuss Campus License</span>
        </a>
      </div>

      {/* Frequently Asked Questions */}
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="text-center space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900">Frequently Asked Questions</h2>
          <p className="text-xs text-zinc-500">Everything you need to know about our Pay-Per-Use pricing model.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-zinc-200 bg-white overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full p-4 text-left font-bold text-xs sm:text-sm text-zinc-900 flex items-center justify-between gap-4"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform ${
                    activeFaq === idx ? "rotate-180 text-zinc-900" : ""
                  }`}
                />
              </button>
              {activeFaq === idx && (
                <div className="px-4 pb-4 text-xs text-zinc-600 leading-relaxed border-t border-zinc-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
