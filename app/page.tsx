import Link from "next/link";
import { getInstitutions } from "@/lib/db/institutions";
import {
  Vote,
  Lock,
  Zap,
  ArrowRight,
  FileCheck2,
  Building2,
  ShieldCheck,
  BarChart3,
  FileSpreadsheet,
  Users,
  Award,
  MessageSquare,
  CheckCircle2,
  Activity,
  Layers,
  Key,
  Check,
} from "lucide-react";

export default async function HomePage() {
  const institutions = await getInstitutions();
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "2349164221215";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    "*STUDENT ELECTION INQUIRY*\n\nHello SuperAdmin, I am reaching out from StudElect.com.ng. I am an ELCOM Chairman / Student Union Executive and would like to inquire about activating our upcoming campus election."
  )}`;

  const homeServiceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "StudElect Student Election Infrastructure",
    serviceType: "Digital Voting Platform & E-Voting System",
    provider: {
      "@type": "Organization",
      name: "StudElect Nigeria",
      url: "https://studelect.com.ng",
    },
    areaServed: {
      "@type": "Country",
      name: "Nigeria",
    },
    audience: {
      "@type": "Audience",
      audienceType:
        "Nigerian Tertiary Institutions, ELCOM Administrators, Student Unions, Academic Departments",
    },
    description:
      "Cryptographically secure, tamper-evident digital election infrastructure designed specifically for Nigerian universities and tertiary institutions.",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "NGN",
      lowPrice: "15000",
      highPrice: "95000",
    },
  };

  return (
    <div className="space-y-20 py-10 relative overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeServiceSchema) }}
      />
      {/* Clean Architectural Grid (Zero colorful gradients) */}
      <div className="absolute inset-0 hero-dot-grid opacity-60 pointer-events-none" />

      {/* ========================================================================= */}
      {/* SECTION 1: HERO & CORE IDENTITY */}
      {/* ========================================================================= */}
      <section className="max-w-5xl mx-auto px-4 text-center space-y-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-700 text-xs font-semibold shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-zinc-900" />
          <span className="font-mono uppercase text-[11px] tracking-wider">The Sovereign E-Voting Protocol for Higher Education</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 leading-[1.15]">
          Decoupled, Verifiable Campus Elections with Zero Rigging
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 max-w-3xl mx-auto font-normal leading-relaxed">
          Engineered specifically for Nigerian tertiary institutions. Eliminates ballot snatching, disputed recounts, and server crashes with cryptographic blind tokens, automated dues screening, and real-time press room telemetry.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href="#campuses"
            className="px-6 py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
          >
            <span>Select Your Campus</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg border border-zinc-300 hover:bg-zinc-100 bg-white text-zinc-800 text-xs font-bold transition flex items-center gap-2 shadow-xs"
          >
            <MessageSquare className="w-4 h-4 text-zinc-700" />
            <span>Chat on WhatsApp</span>
          </a>

          <Link
            href="/admin/login"
            className="px-5 py-3 rounded-lg border border-zinc-200 text-zinc-600 hover:text-zinc-900 text-xs font-semibold transition"
          >
            ELCOM Sign In
          </Link>
        </div>

        {/* 3D Floating Ballot Card & Cryptographic Poll Simulation */}
        <div className="pt-6 max-w-xl mx-auto">
          <div className="floating-ballot-card relative bg-white rounded-2xl border border-zinc-200 shadow-xl p-5 text-left space-y-4">
            {/* Top Security Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
                  <Vote className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                    CRYPTOGRAPHIC BALLOT TOKEN #0x7F4A
                  </span>
                  <p className="text-xs font-bold text-zinc-900">SUG Presidential Ballot • Live Session</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>POLL OPEN</span>
              </span>
            </div>

            {/* Candidates Selection Visual */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 block">
                Contested Office: President & Commander-in-Chief
              </span>

              <div className="p-3 rounded-xl border border-zinc-900 bg-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold font-mono">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-xs text-zinc-900">Adebayo Chukwuma Olawale</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Faculty of Technology • 400L</p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
              </div>

              <div className="p-3 rounded-xl border border-zinc-200 bg-white opacity-60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-zinc-200 text-zinc-700 flex items-center justify-center text-xs font-bold font-mono">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-xs text-zinc-700">Ibrahim Fatima Zahra</p>
                    <p className="text-[10px] text-zinc-400 font-mono">Faculty of Law • 500L</p>
                  </div>
                </div>
                <div className="w-4 h-4 rounded-full border border-zinc-300" />
              </div>
            </div>

            {/* Bottom Proof Bar */}
            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono text-zinc-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-700" />
                <span>Zero-Knowledge Blind Nonce Verified</span>
              </div>
              <span className="text-zinc-400">SHA-256 Sealed</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: PROOF & BRAGGING METRICS STRIP */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 rounded-2xl bg-zinc-900 text-white shadow-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>UPTIME RELIABILITY</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono">99.98%</p>
            <p className="text-[11px] text-zinc-400">
              High-concurrency cluster handling 10,000+ simultaneous rush votes without crashing.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>VERIFIED INTEGRITY</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono">50,000+</p>
            <p className="text-[11px] text-zinc-400">
              Verified ballots cryptographically sealed with zero compromised counts.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
              <Lock className="w-4 h-4 text-blue-400" />
              <span>BALLOT SECRECY</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono">100% Blind</p>
            <p className="text-[11px] text-zinc-400">
              Mathematical separation of voter identity from cast ballots. Zero surveillance.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
              <Zap className="w-4 h-4 text-blue-400" />
              <span>SMS COST SAVINGS</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono">₦0 Waste</p>
            <p className="text-[11px] text-zinc-400">
              Offline ₦0 PIN generation and self-service lookups bypassing telco SMS failures.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: CORE INSTITUTIONAL TRUST PILLARS */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-500">
            ENGINEERED FOR CAMPUS PRESSURE
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900">
            Why Electoral Committees & Deans Trust StudElect
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500">
            Built from the ground up to solve the exact friction points of student politics in Nigeria.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
              <BarChart3 className="w-5 h-5 text-zinc-800" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">Real-Time Press & Observer Telemetry</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Eliminate recount violence. Live multi-color candidate histograms, participation donut charts, and SHA-256 Merkle audit streams allow party agents and campus press to watch votes recorded in real time.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
              <FileSpreadsheet className="w-5 h-5 text-zinc-800" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">Treasurer Dues Compliance Matcher</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Upload raw Excel or CSV sheets from faculty or departmental treasurers. StudElect automatically matches matric numbers and blocks un-cleared defaulters from casting ballots.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
              <ShieldCheck className="w-5 h-5 text-zinc-800" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">Cryptographic Single-Vote Lock</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Voter identities are cryptographically sealed once a ballot is cast. Multiple voting is physically impossible, while students retain full 24/7 access to inspect live results and verify their receipt hashes.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
              <Layers className="w-5 h-5 text-zinc-800" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">Multi-Tenant Hierarchy Architecture</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              One platform effortlessly powers the central Student Union (SUG), all Faculties (Science, Law, Engineering), over 80+ Departments, and all Halls of Residence with isolated administrative domains.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
              <Award className="w-5 h-5 text-zinc-800" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">Official Certificate of Return</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Instant generation of verifiable, tamper-evident Certificates of Return for declared winners, complete with QR code cryptographic verification for smooth executive swearing-in.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900">
              <Users className="w-5 h-5 text-zinc-800" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">100% Localized for Nigerian Campuses</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Intelligent normalizer understands all Nigerian matric formats (e.g. 21/52HA045, 2021/1/89212), academic levels (100L–500L), and campus organizational structures natively.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4: CAMPUS SELECTOR (MULTI-TENANT HUB) */}
      {/* ========================================================================= */}
      <section id="campuses" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-20">
        <div className="border-b border-zinc-200 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Registered Institutions</h2>
            <p className="text-xs text-zinc-500">
              Select a campus to access its active student elections and voter rolls.
            </p>
          </div>
        </div>

        {institutions.length === 0 ? (
          <div className="p-8 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-center space-y-3">
            <Building2 className="w-8 h-8 text-zinc-400 mx-auto" />
            <div>
              <p className="text-sm font-bold text-zinc-800">No Campuses Provisioned Yet</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Please contact your institution&apos;s Electoral Committee or Dean of Student Affairs.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {institutions.map((inst) => (
              <Link
                key={inst.id}
                href={`/${inst.slug}`}
                className="group block rounded-2xl bg-white border border-zinc-200 hover:border-zinc-900 overflow-hidden transition duration-200 shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Campus Landscape Cover Banner */}
                  <div className="h-36 w-full relative bg-zinc-900 overflow-hidden">
                    <img
                      src={inst.coverImageUrl || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80"}
                      alt={`${inst.name} Campus`}
                      className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute top-3 right-3">
                      <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-black/60 text-white backdrop-blur-xs border border-white/20 uppercase tracking-wider">
                        {inst.code}
                      </span>
                    </div>
                  </div>

                  {/* Campus Info & Logo Crest Overlay */}
                  <div className="p-5 pt-0 relative space-y-2.5">
                    <div className="-mt-8 mb-2 flex items-end justify-between">
                      <div className="w-16 h-16 rounded-2xl bg-white border-2 border-white shadow-md p-2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img
                          src={inst.logoUrl || `/logos/${inst.slug}.svg`}
                          alt={inst.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[11px] font-mono text-zinc-400 group-hover:text-zinc-900 font-semibold transition flex items-center gap-1">
                        <span>Enter Campus</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-zinc-900 group-hover:text-zinc-950 transition">
                        {inst.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                        {inst.tagline}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between text-[11px] font-medium text-zinc-500">
                  <span>Official Election Network</span>
                  <span className="font-mono font-bold text-zinc-700">/{inst.slug}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION 5: DIRECT WHATSAPP CONSULTATION & ONBOARDING CTA */}
      {/* ========================================================================= */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-zinc-900 text-white space-y-6 text-center max-w-4xl mx-auto shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-blue-400">
            <MessageSquare className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              Ready to Host Your Campus Election?
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Whether you are conducting an election for a 200-student Department, a 2,500-student Faculty, or a 30,000-student SUG, StudElect can be provisioned in under 15 minutes.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-3.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-bold transition flex items-center gap-2 shadow-md"
            >
              <MessageSquare className="w-4 h-4 text-zinc-900" />
              <span>Chat with SuperAdmin on WhatsApp</span>
            </a>

            <Link
              href="/admin/login"
              className="px-6 py-3.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-bold transition"
            >
              Access ELCOM Dashboard
            </Link>
          </div>

          <div className="flex items-center justify-center gap-6 text-[11px] text-zinc-400 pt-4 border-t border-zinc-800">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />
              <span>15-Minute Setup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />
              <span>Zero SMS Bills</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-300" />
              <span>Cryptographic Proof</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
