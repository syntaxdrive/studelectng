import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Lock,
  Eye,
  Database,
  Globe,
  Mail,
  Bell,
} from "lucide-react";

export const dynamic = "force-static";

export default function PrivacyPolicyPage() {
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
              <ShieldCheck className="w-5 h-5 text-zinc-700" />
            </div>
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Legal &amp; Privacy Compliance
            </span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-xs text-zinc-400 font-mono mb-3">
            Effective Date: September 17, 2026 &bull; Version 2.1
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed mb-6">
            StudElect is committed to protecting the privacy and data rights of
            every student, administrator, and institution on our platform. This
            policy explains what data we collect, why we collect it, and how it
            is stored and protected under the Nigeria Data Protection Regulation (NDPR).
          </p>

          {/* Policy Revision & Update Notice */}
          <div id="policy-changes" className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-blue-900">
              <Bell className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Policy Update Notice (Effective September 17, 2026)</span>
            </div>
            <p className="text-xs text-blue-900/80 leading-relaxed">
              We have updated our Privacy Policy to clarify data retention periods, student PIN security, and cryptographic auditability:
            </p>
            <ul className="list-disc pl-4 text-xs text-blue-900/80 space-y-1">
              <li><strong>Zero Commercial Data Sale:</strong> We strictly confirm StudElect does not sell, license, or monetize student voter information or use cookies for advertising tracking.</li>
              <li><strong>Session-Bound Voter Records:</strong> Matriculation numbers and voter records are retained for the duration of the active academic session.</li>
              <li><strong>Cryptographic Audit Trails:</strong> Anonymous zero-knowledge ballot hashes and audit ledger entries are archived for 5 years strictly for electoral integrity.</li>
            </ul>
          </div>
        </div>

        <div className="space-y-10">
          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                1. Who We Are
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed space-y-2 pl-6">
              <p>
                StudElect is a digital election infrastructure platform built
                exclusively for Nigerian tertiary institutions — universities,
                polytechnics, and colleges of education. We provide secure,
                cryptographically auditable student election systems to Electoral
                Commissions (ELCOM) and student bodies across multiple campuses.
              </p>
              <p>
                We are the data processor acting on behalf of each institution
                (the data controller). Each institution is responsible for the
                accuracy of the voter data they upload.
              </p>
              <p className="font-mono text-xs text-zinc-400">
                Data Protection Contact:{" "}
                <a
                  href="mailto:privacy@studelect.com.ng"
                  className="text-zinc-600 hover:text-zinc-900 transition"
                >
                  privacy@studelect.com.ng
                </a>
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 2 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                2. What Data We Collect
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-3">
              <p>
                When an institution registers voters on StudElect, the following
                data fields may be collected:
              </p>
              <ul className="space-y-1.5">
                {[
                  "Matriculation number",
                  "Full name",
                  "Department and faculty",
                  "Academic level (e.g. 100L, 200L)",
                  "Email address (optional)",
                  "Phone number (optional)",
                  "Voter PIN — generated at issuance, never stored in plaintext",
                  "Voting metadata — encrypted, anonymous ballot hash (cryptographically decoupled from identity)",
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

          {/* Section 3 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                3. Why We Collect This Data
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-3">
              <p>We collect the above data solely for the following purposes:</p>
              <ul className="space-y-1.5">
                {[
                  "Voter identity verification before ballot issuance",
                  "Eligibility screening — dues payment status, disciplinary standing",
                  "Cryptographic ballot issuance and one-time PIN generation",
                  "Fraud prevention and duplicate submission detection",
                  "One-person-one-vote enforcement via cryptographic deduplication",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
                <p className="text-xs font-semibold text-zinc-700">
                  We do <span className="underline">not</span> collect or use any
                  data for advertising, profiling, or sale to third parties.
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 4 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                4. How Your Data Is Stored
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                Voter records are stored in{" "}
                <span className="font-medium text-zinc-700">
                  Supabase PostgreSQL
                </span>{" "}
                with encryption at rest. All database connections are
                TLS-encrypted in transit.
              </p>
              <p>
                Voter PINs are one-time use and are masked on all public screens.
                They are hashed with a strong cryptographic algorithm and are
                never stored in plaintext.
              </p>
              <p>
                Ballot selections are cryptographically decoupled from voter
                identity — an auditor can verify that every vote was cast by an
                eligible voter without being able to determine how any individual
                voted.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 5 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                5. Cookies &amp; Sessions
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                StudElect uses session cookies strictly for administrator
                authentication — specifically for ELCOM and SuperAdmin dashboard
                access.
              </p>
              <p>
                We do <span className="font-medium text-zinc-700">not</span> use
                tracking cookies, third-party advertising cookies, analytics
                cookies, or any form of cross-site tracking. For full details,
                see our{" "}
                <Link
                  href="/legal/cookies"
                  className="text-zinc-700 underline hover:text-zinc-900 transition"
                >
                  Cookie Policy
                </Link>
                .
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 6 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                6. Who Can See Your Data
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                Only your institution's registered{" "}
                <span className="font-medium text-zinc-700">
                  ELCOM (Electoral Commission) administrators
                </span>{" "}
                can access voter roll data for their institution. ELCOM
                administrators cannot access data from other institutions.
              </p>
              <p>
                StudElect platform administrators (SuperAdmin) manage
                institutional licensing and platform infrastructure. They do not
                access voter-level data in the normal course of operations.
              </p>
              <p>
                We do not share personal data with any third party except as
                required by Nigerian law or a valid court order.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 7 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                7. Your Rights
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                Under applicable Nigerian data protection law (NDPR), you have
                the right to:
              </p>
              <ul className="space-y-1.5 mt-2">
                {[
                  "Access your voter record held by your institution's ELCOM",
                  "Request correction of inaccurate personal data",
                  "Request deletion of your data after the election cycle concludes",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3">
                To exercise these rights, contact your institution's ELCOM
                directly or email us at{" "}
                <a
                  href="mailto:privacy@studelect.com.ng"
                  className="text-zinc-700 underline hover:text-zinc-900 transition"
                >
                  privacy@studelect.com.ng
                </a>
                .
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 8 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                8. Data Retention
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                Voter records are retained for the duration of the active
                academic session. At the end of an election cycle, voter roll
                data may be archived or deleted at the request of the
                institution.
              </p>
              <p>
                Audit ledger entries — which record that votes were cast (but not
                how) — are retained for{" "}
                <span className="font-medium text-zinc-700">5 years</span> for
                electoral integrity and dispute resolution purposes.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 9 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                9. Contact
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                For any privacy-related questions, data requests, or complaints,
                please contact our Data Protection team:
              </p>
              <p className="font-mono text-xs text-zinc-400">
                <a
                  href="mailto:privacy@studelect.com.ng"
                  className="text-zinc-600 hover:text-zinc-900 transition"
                >
                  privacy@studelect.com.ng
                </a>
              </p>
              <p>
                We aim to respond to all privacy enquiries within 5 business
                days.
              </p>
            </div>
          </section>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-6 border-t border-zinc-100">
          <p className="text-[11px] text-zinc-400 text-center font-mono">
            StudElect Nigeria · studelect.com.ng · NDPR Compliant
          </p>
        </div>
      </div>
    </div>
  );
}
