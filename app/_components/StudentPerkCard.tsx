"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ExternalLink, X, Gift, CheckCircle, ShieldCheck } from "lucide-react";
import { PartnerPerk, PerkPlacement } from "@/lib/perks";
import {
  getPartnerPerksAction,
  trackPerkInteractionAction,
} from "@/app/actions/super-admin";

interface StudentPerkCardProps {
  placement: PerkPlacement;
  institutionSlug?: string;
  className?: string;
  compact?: boolean;
}

export function StudentPerkCard({
  placement,
  institutionSlug,
  className = "",
  compact = false,
}: StudentPerkCardProps) {
  const [perk, setPerk] = useState<PartnerPerk | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadPerk() {
      try {
        const res = await getPartnerPerksAction({
          placement,
          institutionSlug,
          activeOnly: true,
        });
        if (isMounted && res.success && res.perks.length > 0) {
          // Select top priority active perk
          const selected = res.perks[0];
          setPerk(selected);
        }
      } catch (err) {
        console.warn("Error loading student perk:", err);
      }
    }
    loadPerk();
    return () => {
      isMounted = false;
    };
  }, [placement, institutionSlug]);

  useEffect(() => {
    if (perk && !hasTrackedImpression) {
      setHasTrackedImpression(true);
      trackPerkInteractionAction(perk.id, "impression").catch(() => {});
    }
  }, [perk, hasTrackedImpression]);

  if (!perk || isDismissed) return null;

  const handleClick = () => {
    trackPerkInteractionAction(perk.id, "click").catch(() => {});
  };

  // Helper to format video embed URLs if a standard YouTube/Vimeo URL was provided
  const getVideoEmbedUrl = (url: string) => {
    if (!url) return null;
    if (url.includes("youtube.com/watch?v=")) {
      return url.replace("watch?v=", "embed/");
    }
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (url.includes("vimeo.com/")) {
      const id = url.split("vimeo.com/")[1]?.split("?")[0];
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
    return url;
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-b from-white via-zinc-50/50 to-zinc-50 p-5 shadow-xs transition-all hover:border-zinc-300 text-left ${className}`}
    >
      {/* Subtle background decorative accent */}
      <div className="absolute top-0 right-0 -mt-6 -mr-6 w-24 h-24 bg-amber-100/40 rounded-full blur-2xl pointer-events-none" />

      {/* Header bar: Badge, Sponsor attribution & Dismiss */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/60 shadow-2xs">
            <Sparkles className="w-3 h-3 text-amber-600 fill-amber-500" />
            <span>{perk.badge || "Exclusive Student Perk"}</span>
          </span>

          <span className="text-[11px] text-zinc-500 font-medium">
            In partnership with <strong className="text-zinc-800">{perk.sponsorName}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition"
          title="Dismiss this offer"
          aria-label="Dismiss offer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Optional Media: Image Banner or Video Embed */}
      {perk.mediaType === "IMAGE" && perk.mediaUrl && (
        <div className="mb-3.5 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 max-h-48 flex items-center justify-center">
          <img
            src={perk.mediaUrl}
            alt={perk.title}
            className="w-full h-full object-cover max-h-48 hover:scale-[1.01] transition duration-300"
            loading="lazy"
          />
        </div>
      )}

      {perk.mediaType === "VIDEO" && perk.mediaUrl && (
        <div className="mb-3.5 overflow-hidden rounded-xl border border-zinc-200 bg-black aspect-video">
          <iframe
            src={getVideoEmbedUrl(perk.mediaUrl) || perk.mediaUrl}
            title={perk.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-bold text-zinc-900 leading-snug">
          {perk.title}
        </h3>
        <p className="text-xs text-zinc-600 leading-relaxed">
          {perk.description}
        </p>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-zinc-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Verified Student Partner Offer • Zero Spam Guarantee</span>
        </div>

        <a
          href={perk.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition shadow-xs hover:shadow-sm"
        >
          <span>{perk.ctaText || "Claim Student Perk →"}</span>
          <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
        </a>
      </div>
    </div>
  );
}
