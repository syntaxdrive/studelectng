import Link from "next/link";
import { Cookie, ArrowLeft, ShieldCheck, Lock } from "lucide-react";

export const dynamic = "force-static";

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Back nav */}
      <div className="border-b border-zinc-100 bg-zinc-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to StudElect
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="mb-10 pb-8 border-b border-zinc-200">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-lg bg-zinc-100 border border-zinc-200">
              <Cookie className="w-5 h-5 text-zinc-700" />
            </div>
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Legal
            </span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">
            Cookie Policy
          </h1>
          <p className="text-xs text-zinc-400 font-mono mb-3">
            Last updated: September 2026
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed">
            This Cookie Policy explains what cookies are, which cookies
            StudElect uses, and why. We keep our cookie usage minimal and
            purposeful — no tracking, no advertising.
          </p>
        </div>

        <div className="space-y-10">
          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Cookie className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                1. What Are Cookies
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                Cookies are small text files that a website places on your
                device when you visit it. They are widely used to make websites
                work, or work more efficiently, and to provide information to the
                website's operators.
              </p>
              <p>
                Cookies can be "session cookies" (deleted when you close your
                browser) or "persistent cookies" (stored on your device for a set
                period). They can be "first-party" (set by the site you are
                visiting) or "third-party" (set by a different domain).
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 2 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                2. Cookies We Use
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-4">
              <p>
                StudElect uses exactly{" "}
                <span className="font-medium text-zinc-700">
                  one first-party session cookie
                </span>
                :
              </p>

              {/* Cookie detail card */}
              <div className="rounded-lg border border-zinc-200 overflow-hidden">
                <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2.5">
                  <p className="text-xs font-mono font-semibold text-zinc-700">
                    studelect_admin_session
                  </p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {[
                    {
                      label: "Purpose",
                      value:
                        "ELCOM and SuperAdmin dashboard authentication",
                    },
                    { label: "Type", value: "First-party, persistent" },
                    {
                      label: "HTTP-only",
                      value: "Yes — cannot be accessed by JavaScript",
                    },
                    { label: "Encryption", value: "AES-256 encrypted" },
                    {
                      label: "Expiry",
                      value:
                        "7 days, or immediately on logout (whichever comes first)",
                    },
                    { label: "Scope", value: "studelect.com.ng domain only" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3 text-xs">
                      <span className="w-24 flex-shrink-0 font-medium text-zinc-600">
                        {label}
                      </span>
                      <span className="text-zinc-500">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50">
                <p className="text-xs font-semibold text-zinc-700">
                  This is the only cookie StudElect sets. No other cookies are
                  created under any circumstances.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 3 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                3. What We Do NOT Use
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-3">
              <p>StudElect does not use any of the following:</p>
              <ul className="space-y-1.5">
                {[
                  "Google Analytics or any web analytics service",
                  "Facebook Pixel or any social media tracking",
                  "Ad network cookies or interest-based advertising",
                  "Browser fingerprinting or device identification techniques",
                  "Third-party session replay or heatmap tools",
                  "Cross-site tracking of any kind",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 4 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                4. Student Voter Portal
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                The student voter portal does{" "}
                <span className="font-medium text-zinc-700">not</span> set any
                cookies whatsoever.
              </p>
              <p>
                Voter session state — including ballot issuance status and
                eligibility data — is maintained entirely in encrypted{" "}
                <span className="font-medium text-zinc-700">sessionStorage</span>{" "}
                in the browser. This data exists only for the duration of the
                active voting session and is automatically cleared when the
                student logs out or closes the browser tab.
              </p>
              <p>
                No voter identity or ballot data is persisted locally on the
                student's device beyond the active session.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 5 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Cookie className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                5. Managing Cookies
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                You can view, delete, or block cookies at any time using your
                browser's built-in settings. The steps vary by browser:
              </p>
              <ul className="space-y-1.5 mt-2">
                {[
                  "Chrome: Settings → Privacy and Security → Cookies and other site data",
                  "Firefox: Settings → Privacy & Security → Cookies and Site Data",
                  "Safari: Preferences → Privacy → Manage Website Data",
                  "Edge: Settings → Cookies and site permissions",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
                <p className="text-xs font-semibold text-zinc-700">
                  Clearing or blocking the{" "}
                  <span className="font-mono">studelect_admin_session</span>{" "}
                  cookie will immediately sign out any active ELCOM or SuperAdmin
                  session. This has no effect on the student voter portal.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 6 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                6. Contact
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                If you have questions about our cookie usage, please contact:
              </p>
              <p className="font-mono text-xs text-zinc-400">
                <a
                  href="mailto:privacy@studelect.com.ng"
                  className="text-zinc-600 hover:text-zinc-900 transition"
                >
                  privacy@studelect.com.ng
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-6 border-t border-zinc-100">
          <p className="text-[11px] text-zinc-400 text-center font-mono">
            StudElect Nigeria · studelect.com.ng · Zero tracking. Zero ads.
          </p>
        </div>
      </div>
    </div>
  );
}
