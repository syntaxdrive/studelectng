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

export const DEFAULT_PARTNER_PERKS: PartnerPerk[] = [
  {
    id: "perk-piggyvest-bonus",
    title: "Claim ₦1,000 Welcome Bonus on Your First Savings Lock",
    badge: "Exclusive Student Perk",
    description: "Start building financial independence with Nigeria's leading student wealth app. Sign up with your university email to unlock an instant ₦1,000 Safelock bonus.",
    sponsorName: "Piggyvest",
    sponsorLogoUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=100&h=100&fit=crop&q=80",
    mediaType: "IMAGE",
    mediaUrl: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=400&fit=crop&q=80",
    ctaText: "Claim ₦1,000 Student Bonus →",
    ctaUrl: "https://piggyvest.com",
    placements: ["POST_VOTE_RECEIPT", "PIN_REGISTRATION"],
    targetInstitutions: ["ALL"],
    active: true,
    priority: 1,
    createdAt: "2026-09-01T00:00:00Z",
    impressionsCount: 2450,
    clicksCount: 382,
  },
  {
    id: "perk-mtn-pulse-data",
    title: "Get 2GB Campus Data Bundle for ₦500",
    badge: "Campus Partner Offer",
    description: "Stay connected across lecture theatres and hostels. Enjoy verified campus night & weekend data bundles tailored for Nigerian undergraduates.",
    sponsorName: "MTN Pulse Campus",
    sponsorLogoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop&q=80",
    mediaType: "NONE",
    ctaText: "Activate Campus Bundle →",
    ctaUrl: "https://mtn.ng",
    placements: ["POST_VOTE_RECEIPT", "CAMPUS_HUB"],
    targetInstitutions: ["ALL"],
    active: true,
    priority: 2,
    createdAt: "2026-09-05T00:00:00Z",
    impressionsCount: 1890,
    clicksCount: 290,
  },
];
