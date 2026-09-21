import type { Metadata } from "next";
import { getInstitutionBySlug } from "@/lib/db/institutions";
import { supabase } from "@/lib/supabase";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ institution: string; organization: string }>;
}

// Known association names lookup dictionary
const KNOWN_ORGS: Record<string, { name: string; code: string }> = {
  nesa: {
    name: "Nigerian Economics Students' Association (NESA)",
    code: "NESA",
  },
  renarsa: {
    name: "Renewable Natural Resources Students Association (RENARSA)",
    code: "RENARSA",
  },
  sug: {
    name: "Student Union Government (SUG)",
    code: "SUG",
  },
  nacos: {
    name: "Nigeria Association of Computing Students (NACOS)",
    code: "NACOS",
  },
};

async function resolveOrgInfo(instSlug: string, orgSlug: string) {
  const cleanOrg = orgSlug.toLowerCase().trim();
  if (KNOWN_ORGS[cleanOrg]) {
    return KNOWN_ORGS[cleanOrg];
  }

  // Try database lookup
  try {
    const { data } = await supabase
      .from("organizations")
      .select("name, code")
      .eq("slug", cleanOrg)
      .maybeSingle();

    if (data?.name) {
      return {
        name: data.name,
        code: data.code || cleanOrg.toUpperCase(),
      };
    }
  } catch (_) {}

  return {
    name: `${cleanOrg.toUpperCase()} Association`,
    code: cleanOrg.toUpperCase(),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ institution: string; organization: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  const instSlug = (resolved?.institution || "ui").toLowerCase().trim();
  const orgSlug = (resolved?.organization || "nesa").toLowerCase().trim();

  const [inst, org] = await Promise.all([
    getInstitutionBySlug(instSlug),
    resolveOrgInfo(instSlug, orgSlug),
  ]);

  const campusName = inst?.name || instSlug.toUpperCase();
  const campusCode = inst?.code || instSlug.toUpperCase();
  const currentYear = new Date().getFullYear();

  const title = `${org.code} Election & Voter Accreditation Portal • ${campusCode}`;
  const description = `Accredited voting and accreditation portal for ${org.name} at ${campusName} (${currentYear}). Check voter roll eligibility, retrieve confidential PIN slips, and view real-time press room results.`;
  const canonical = `https://studelect.com.ng/${instSlug}/${orgSlug}`;
  const ogImage = inst?.coverImageUrl || inst?.logoUrl || "/studelect-logo.jpg";

  return {
    title,
    description,
    keywords: [
      `${org.code} election`,
      `${org.name}`,
      `${org.code} ${campusCode} voting`,
      `${campusName} ${org.code} election portal`,
      `accredited voting ${org.code}`,
      `${campusCode} student union election`,
    ],
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} | StudElect`,
      description,
      url: canonical,
      siteName: "StudElect",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${org.code} Election — ${campusName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | StudElect`,
      description,
      images: [ogImage],
    },
  };
}

export default async function OrgLayout({
  children,
  params,
}: OrgLayoutProps) {
  const resolved = await params;
  const instSlug = (resolved?.institution || "ui").toLowerCase().trim();
  const orgSlug = (resolved?.organization || "nesa").toLowerCase().trim();

  const [inst, org] = await Promise.all([
    getInstitutionBySlug(instSlug),
    resolveOrgInfo(instSlug, orgSlug),
  ]);

  const campusName = inst?.name || instSlug.toUpperCase();
  const currentYear = new Date().getFullYear();
  const pageUrl = `https://studelect.com.ng/${instSlug}/${orgSlug}`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://studelect.com.ng",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: campusName,
        item: `https://studelect.com.ng/${instSlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${org.code} Election`,
        item: pageUrl,
      },
    ],
  };

  const electionEventSchema = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${org.name} Executive Election ${currentYear}`,
    description: `Official student executive elections for ${org.name} at ${campusName}. Powered by StudElect's cryptographic voting infrastructure.`,
    startDate: `${currentYear}-01-01T08:00:00+01:00`,
    endDate: `${currentYear}-12-31T18:00:00+01:00`,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "VirtualLocation",
      url: pageUrl,
    },
    organizer: {
      "@type": "Organization",
      name: org.name,
      url: pageUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(electionEventSchema) }}
      />
      {children}
    </>
  );
}
