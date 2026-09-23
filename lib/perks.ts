/**
 * StudElect Partner Perks & Sponsored Campus Rewards System
 * 
 * Non-disruptive, high-value student rewards and sponsor perks
 * displayed cleanly on post-action screens (post-vote receipt and PIN retrieval).
 */

export type PerkPlacement = "POST_VOTE_RECEIPT" | "PIN_REGISTRATION" | "CAMPUS_HUB";
export type PerkMediaType = "IMAGE" | "VIDEO" | "NONE";

export interface PartnerPerk {
  id: string;
  title: string;
  badge: string;
  description: string;
  sponsorName: string;
  sponsorLogoUrl?: string;
  mediaType: PerkMediaType;
  mediaUrl?: string;
  ctaText: string;
  ctaUrl: string;
  placements: PerkPlacement[];
  targetInstitutions: string[]; // ["ALL"] or specific slug e.g. ["ui", "unilag"]
  active: boolean;
  priority: number;
  createdAt: string;
  updatedAt?: string;
  impressionsCount?: number;
  clicksCount?: number;
}

export const DEFAULT_PARTNER_PERKS: PartnerPerk[] = [];
