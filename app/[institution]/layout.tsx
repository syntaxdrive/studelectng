import type { Metadata } from "next";
import { getInstitutionBySlug } from "@/lib/db/institutions";

interface CampusLayoutProps {
  children: React.ReactNode;
  params: Promise<{ institution: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ institution: string }>;
}): Promise<Metadata> {
  const resolved = await params;
  const slug = (resolved?.institution || "ui").toLowerCase().trim();
  const inst = await getInstitutionBySlug(slug);

  const campusName = inst?.name || `${slug.toUpperCase()} Campus`;
  const campusCode = inst?.code || slug.toUpperCase();
  const tagline = inst?.tagline || "Higher Education E-Voting Hub";
  const title = `${campusName} (${campusCode}) Campus Elections & Voting Portal`;
  const description = `Official accredited student election portal for ${campusName}. Real-time cryptographic ballot auditing, departmental, faculty, and SUG elections on StudElect.`;
  const canonical = `https://studelect.com.ng/${slug}`;
  const ogImage = inst?.coverImageUrl || inst?.logoUrl || "/studelect-logo.jpg";

  return {
    title,
    description,
    keywords: [
      `${campusName} election`,
      `${campusCode} student elections`,
      `${campusName} SUG voting`,
      `${campusCode} departmental election portal`,
      `${campusName} ELCOM portal`,
      `${campusCode} student voting system`,
    ],
    alternates: {
      canonical,
    },
    openGraph: {
      title: `${title} • StudElect`,
      description,
      url: canonical,
      siteName: "StudElect",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${campusName} Election Hub`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} • StudElect`,
      description,
      images: [ogImage],
    },
  };
}

export default async function CampusLayout({
  children,
  params,
}: CampusLayoutProps) {
  const resolved = await params;
  const slug = (resolved?.institution || "ui").toLowerCase().trim();
  const inst = await getInstitutionBySlug(slug);
  const campusName = inst?.name || `${slug.toUpperCase()} Campus`;

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
        name: "Campuses",
        item: "https://studelect.com.ng/#campuses",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: campusName,
        item: `https://studelect.com.ng/${slug}`,
      },
    ],
  };

  const educationalOrgSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: campusName,
    alternateName: inst?.code || slug.toUpperCase(),
    url: `https://studelect.com.ng/${slug}`,
    logo: inst?.logoUrl ? `https://studelect.com.ng${inst.logoUrl.startsWith('/') ? '' : '/'}${inst.logoUrl}` : undefined,
    description: inst?.tagline || `Student voting hub for ${campusName}.`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(educationalOrgSchema) }}
      />
      {children}
    </>
  );
}
