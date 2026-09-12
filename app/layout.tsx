import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Building2, Lock, ShieldCheck, LayoutDashboard, Zap } from "lucide-react";
import { getAdminSession } from "@/lib/auth/session";
import LogoutButton from "@/app/_components/LogoutButton";

export const metadata: Metadata = {
  metadataBase: new URL("https://studelect.ng"),
  title: {
    default: "StudElect • Secure Student Elections for Nigerian Universities",
    template: "%s • StudElect",
  },
  description:
    "StudElect is Nigeria's leading digital election platform for tertiary institutions. Cryptographically secure, constitutionally compliant student elections with real-time audit trails.",
  keywords: [
    "student elections Nigeria",
    "university elections platform",
    "ELCOM digital voting",
    "student union election",
    "SUG election software Nigeria",
    "NESA NACOS election portal",
    "secure student voting",
    "Nigerian university election system",
  ],
  authors: [{ name: "StudElect", url: "https://studelect.ng" }],
  creator: "StudElect Nigeria",
  publisher: "StudElect Nigeria",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://studelect.ng",
    siteName: "StudElect",
    title: "StudElect • Secure Student Elections for Nigerian Universities",
    description:
      "Nigeria's most trusted cryptographic student election platform. Multi-campus, multi-organisation, real-time results.",
    images: [
      {
        url: "/studelect-logo.jpg",
        width: 1200,
        height: 630,
        alt: "StudElect — Secure Student Elections",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StudElect • Secure Student Elections",
    description: "Nigeria's leading cryptographic student election platform.",
    images: ["/studelect-logo.jpg"],
    creator: "@studelect_ng",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/studelect-mark.jpg",
  },
  verification: {
    google: "REPLACE_WITH_GOOGLE_SEARCH_CONSOLE_TOKEN",
  },
  alternates: {
    canonical: "https://studelect.ng",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAdminSession();

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-zinc-50/50 text-zinc-900 font-sans">
        {/* Sleek Minimalist Conditional Navbar */}
        <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 print:hidden">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2">
            {/* Logo — always visible, never shrinks */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <img
                src="/studelect-mark.jpg"
                alt="StudElect Emblem"
                className="h-8 w-8 rounded-lg object-cover shadow-xs"
              />
              <span className="text-sm font-bold tracking-tight text-zinc-900 hidden xs:inline sm:inline">
                Stud<span className="text-blue-600">Elect</span>
              </span>
            </Link>

            <nav className="flex items-center gap-1 sm:gap-2 text-xs font-medium min-w-0">
              {/* Campuses — icon only on mobile, icon+text on sm+ */}
              <Link
                href="/#campuses"
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition flex items-center gap-1.5 flex-shrink-0"
                title="Campuses"
              >
                <Building2 className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                <span className="hidden sm:inline">Campuses</span>
              </Link>

              {/* Pricing — icon only on mobile */}
              <Link
                href="/pricing"
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition flex items-center gap-1.5 flex-shrink-0"
                title="Pricing"
              >
                <Zap className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="hidden sm:inline">Pricing</span>
              </Link>

              {session ? (
                /* Authenticated Admin View */
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                  <Link
                    href={
                      session.role === "SUPER_ADMIN"
                        ? "/super-admin"
                        : `/${session.institutionSlug || "unilag"}/admin`
                    }
                    className="px-2 py-1.5 sm:px-3 rounded-md bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-zinc-800 transition flex items-center gap-1.5 min-w-0 max-w-[160px] sm:max-w-none"
                    title="Dashboard"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />
                    <span className="font-semibold truncate">{session.fullName.split(" ")[0]}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-white flex-shrink-0 hidden xs:inline-flex sm:inline-flex">
                      {session.role === "SUPER_ADMIN" ? "SUPER" : "ELCOM"}
                    </span>
                  </Link>

                  {/* Logout — instant client-side optimistic redirect */}
                  <LogoutButton />
                </div>
              ) : (
                /* Unauthenticated Public View */
                <Link
                  href="/admin/login"
                  className="px-2.5 py-1.5 sm:px-3 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition font-semibold flex items-center gap-1.5 shadow-xs flex-shrink-0"
                >
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden xs:inline sm:inline">Admin Sign In</span>
                </Link>
              )}
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-zinc-200 bg-white py-10 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pb-8 border-b border-zinc-100">
              {/* Brand */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <img src="/studelect-mark.jpg" alt="StudElect" className="h-7 w-7 rounded-md object-cover" />
                  <span className="text-sm font-bold text-zinc-900">
                    Stud<span className="text-blue-600">Elect</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
                  Nigeria's cryptographically secure student election platform. Multi-campus. Real-time audit trails. Zero paper ballots.
                </p>
                <p className="text-[11px] text-zinc-400 font-mono">privacy@studelect.ng</p>
              </div>

              {/* Platform */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Platform</h4>
                <ul className="space-y-2 text-xs text-zinc-500">
                  <li><Link href="/#campuses" className="hover:text-zinc-900 transition">Campuses</Link></li>
                  <li><Link href="/pricing" className="hover:text-zinc-900 transition">Pricing Plans</Link></li>
                  <li><Link href="/admin/login" className="hover:text-zinc-900 transition">ELCOM Sign In</Link></li>
                  <li><Link href="/super-admin" className="hover:text-zinc-900 transition">Platform Admin</Link></li>
                </ul>
              </div>

              {/* Legal */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Legal &amp; Compliance</h4>
                <ul className="space-y-2 text-xs text-zinc-500">
                  <li><Link href="/legal/privacy" className="hover:text-zinc-900 transition">Privacy Policy</Link></li>
                  <li><Link href="/legal/terms" className="hover:text-zinc-900 transition">Terms of Service</Link></li>
                  <li><Link href="/legal/cookies" className="hover:text-zinc-900 transition">Cookie Policy</Link></li>
                  <li><a href="mailto:legal@studelect.ng" className="hover:text-zinc-900 transition">Contact Legal</a></li>
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-600" />
                <span>StudElect Nigeria &copy; {new Date().getFullYear()}. All rights reserved.</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                End-to-end cryptographic auditability &bull; Constitutional eligibility screening &bull; NDPR compliant
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
