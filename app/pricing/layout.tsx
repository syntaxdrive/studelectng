import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transparent Pricing for Nigerian University Student Elections",
  description:
    "Predictable, transparent election infrastructure pricing for Nigerian universities. Micro, Departmental, Faculty, and SUG campus tiers starting from ₦15,000.",
  keywords: [
    "student election pricing Nigeria",
    "cost of university e-voting Nigeria",
    "SUG election portal cost",
    "departmental election platform price",
    "faculty election software price",
    "ELCOM online voting pricing",
  ],
  alternates: {
    canonical: "https://studelect.com.ng/pricing",
  },
  openGraph: {
    title: "Transparent Pricing for Nigerian University Student Elections • StudElect",
    description:
      "Activate cryptographic e-voting for your department, faculty, or SUG with zero hidden fees. Plans start at ₦15,000.",
    url: "https://studelect.com.ng/pricing",
    images: ["/studelect-logo.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing • StudElect Student Elections",
    description: "Predictable, transparent election packages for Nigerian campuses.",
    images: ["/studelect-logo.jpg"],
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How does payment and election activation work?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Select your preferred plan and click Choose Plan. You will be connected directly to the SuperAdmin verification desk via WhatsApp to verify your ELCOM credentials, receive official invoice clearance, and have your campus portal unlocked within minutes.",
        },
      },
      {
        "@type": "Question",
        name: "What happens if our voter turnout exceeds our plan's voter limit?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "StudElect never cuts off active voting mid-election. If your accredited turnout crosses your plan bracket, the press room will issue an overage notification and you can reconcile the difference upon election certification without service interruption.",
        },
      },
      {
        "@type": "Question",
        name: "Does our ELCOM commission receive training and onboarding support?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Every plan includes comprehensive administrative documentation, Excel voter roll import templates, candidate ballot setup guides, and live priority WhatsApp clearance assistance from our engineering desk.",
        },
      },
      {
        "@type": "Question",
        name: "Can one faculty license cover multiple departmental elections?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The Faculty Enterprise plan supports up to 8,000 voters and can host the apex Faculty Association executive election as well as departmental ballots under a shared institutional umbrella.",
        },
      },
      {
        "@type": "Question",
        name: "How is student data protected under Nigerian privacy regulations?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "All voter records are encrypted in transit and at rest in accordance with NDPR guidelines. Voter PINs are salted hashes, and secret ballots are decoupled from student matriculation records using blind nonces.",
        },
      },
      {
        "@type": "Question",
        name: "Can we test the voting booth before election day?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Once your workspace is activated, you can run simulated mock ballots in staging mode to familiarize your electoral commissioners and candidates with the audit dashboard prior to poll opening.",
        },
      },
    ],
  };

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "StudElect Election Infrastructure License",
    description:
      "Digital student voting system with cryptographic blind ballots, automated eligibility screening, and real-time press room telemetry for Nigerian tertiary institutions.",
    brand: {
      "@type": "Brand",
      name: "StudElect",
    },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "NGN",
      lowPrice: "15000",
      highPrice: "150000",
      offerCount: "4",
      offers: [
        {
          "@type": "Offer",
          name: "Micro Tier",
          price: "15000",
          priceCurrency: "NGN",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Department Pro",
          price: "30000",
          priceCurrency: "NGN",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Faculty Pro",
          price: "65000",
          priceCurrency: "NGN",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "SUG / Apex Sovereign",
          price: "150000",
          priceCurrency: "NGN",
          availability: "https://schema.org/InStock",
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {children}
    </>
  );
}
