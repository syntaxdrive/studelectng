"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, Bell, ShieldCheck, X, ArrowRight } from "lucide-react";

export const CURRENT_POLICY_VERSION = "2026-09-17";
const STORAGE_KEY = "studelect_policy_consent";

interface StoredConsent {
  accepted: boolean;
  version: string;
  timestamp: number;
}

export default function PolicyConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [bannerMode, setBannerMode] = useState<"NEW_VISITOR" | "POLICY_UPDATE" | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // New visitor who has never consented
        setBannerMode("NEW_VISITOR");
        setIsVisible(true);
      } else {
        const parsed: StoredConsent = JSON.parse(raw);
        if (parsed.version !== CURRENT_POLICY_VERSION) {
          // User consented to an older version — notify of policy change
          setBannerMode("POLICY_UPDATE");
          setIsVisible(true);
        }
      }
    } catch (_) {
      // Fallback: show banner if storage read fails
      setBannerMode("NEW_VISITOR");
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      const consent: StoredConsent = {
        accepted: true,
        version: CURRENT_POLICY_VERSION,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (_) {}
    setIsVisible(false);
  };

  const handleDismiss = () => {
    // Record acknowledgment so it doesn't repeatedly annoy the user in the same session
    handleAccept();
  };

  if (!mounted || !isVisible || !bannerMode) {
    return null;
  }

  return (
    <aside
      aria-label="Privacy and Cookie Consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 print:hidden transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="bg-white/95 backdrop-blur-md border border-zinc-300 shadow-2xl rounded-2xl p-4 sm:p-5 text-zinc-900 space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800 flex-shrink-0">
              {bannerMode === "POLICY_UPDATE" ? (
                <Bell className="w-4 h-4 text-blue-600 animate-bounce" />
              ) : (
                <Cookie className="w-4 h-4 text-zinc-700" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm tracking-tight text-zinc-900">
                {bannerMode === "POLICY_UPDATE"
                  ? "Policy Update Notice (Sept 2026)"
                  : "Cookie & Privacy Choice"}
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                {bannerMode === "POLICY_UPDATE" ? "Revised Legal Terms" : "NDPR & Cryptographic Compliance"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss consent notice"
            className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {bannerMode === "POLICY_UPDATE" ? (
          <p className="text-xs text-zinc-600 leading-relaxed">
            We have updated our{" "}
            <Link
              href="/legal/privacy"
              className="text-zinc-900 font-semibold underline underline-offset-2 hover:text-blue-600"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/terms"
              className="text-zinc-900 font-semibold underline underline-offset-2 hover:text-blue-600"
            >
              Terms of Service
            </Link>{" "}
            with enhanced student voter data protection and 5-year cryptographic audit rules. By continuing to use StudElect, you agree to the revised terms.
          </p>
        ) : (
          <p className="text-xs text-zinc-600 leading-relaxed">
            StudElect uses <strong>strictly essential cookies</strong> solely for secure electoral administrator authentication. We never track you, profile students, or sell data. By using StudElect, you accept our{" "}
            <Link
              href="/legal/cookies"
              className="text-zinc-900 font-semibold underline underline-offset-2 hover:text-blue-600"
            >
              Cookie Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              className="text-zinc-900 font-semibold underline underline-offset-2 hover:text-blue-600"
            >
              Privacy Policy
            </Link>.
          </p>
        )}

        <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={handleAccept}
            className="flex-1 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{bannerMode === "POLICY_UPDATE" ? "Acknowledge & Continue" : "Accept Essential & Continue"}</span>
          </button>
          <Link
            href={bannerMode === "POLICY_UPDATE" ? "/legal/privacy" : "/legal/cookies"}
            onClick={() => setIsVisible(false)}
            className="px-3 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium text-center transition flex items-center justify-center gap-1"
          >
            <span>{bannerMode === "POLICY_UPDATE" ? "View Changes" : "Policy Details"}</span>
            <ArrowRight className="w-3 h-3 text-zinc-400" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
