"use client";

import Link from "next/link";
import {
  Scale,
  ArrowLeft,
  AlertTriangle,
  FileText,
  ShieldCheck,
} from "lucide-react";

export default function TermsOfServicePage() {
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
              <Scale className="w-5 h-5 text-zinc-700" />
            </div>
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
              Legal
            </span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight mb-2">
            Terms of Service
          </h1>
          <p className="text-xs text-zinc-400 font-mono mb-3">
            Last updated: September 2026
          </p>
          <p className="text-sm text-zinc-500 leading-relaxed">
            These Terms of Service govern your use of the StudElect platform.
            Please read them carefully before using the platform as a student
            voter, ELCOM administrator, or institutional representative.
          </p>
        </div>

        <div className="space-y-10">
          {/* Section 1 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                1. Acceptance of Terms
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                By accessing or using StudElect, you agree to be bound by these
                Terms of Service and our{" "}
                <Link
                  href="/legal/privacy"
                  className="text-zinc-700 underline hover:text-zinc-900 transition"
                >
                  Privacy Policy
                </Link>
                . If you do not agree to these terms, you may not use the
                platform.
              </p>
              <p>These terms apply to all users of the platform, including:</p>
              <ul className="space-y-1.5 mt-2">
                {[
                  "Students accessing the voter portal",
                  "ELCOM (Electoral Commission) administrators",
                  "Institutional administrators and licensing contacts",
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

          {/* Section 2 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                2. Platform Use
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                StudElect is a licensed B2B election infrastructure service.
                Access to the platform is granted exclusively through
                institutional licences — student access to the voter portal is
                provided by, and at the discretion of, the student's
                institution's Electoral Commission (ELCOM).
              </p>
              <p>
                Students do not hold a direct contractual relationship with
                StudElect. Their use of the voter portal is governed by the
                terms set by their institution and these Terms of Service.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 3 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                3. Voter Conduct
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                Each registered student voter may cast exactly{" "}
                <span className="font-medium text-zinc-700">one ballot</span>{" "}
                per election. This is enforced cryptographically at the platform
                level.
              </p>
              <p>
                Attempting to circumvent the one-person-one-vote system — by any
                means including using another student's credentials, submitting
                duplicate requests, or exploiting technical vulnerabilities —
                constitutes a violation of these Terms and may be reported
                directly to the student's institution for disciplinary action.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 4 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                4. ELCOM Administrator Obligations
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                ELCOM administrators who are granted access to the StudElect
                administration dashboard are responsible for:
              </p>
              <ul className="space-y-1.5 mt-2">
                {[
                  "Maintaining accurate and current voter rolls for their institution",
                  "Conducting thorough candidate screening in accordance with their institution's constitution",
                  "Ensuring the integrity of the election process within their institution",
                  "Keeping their administrator credentials confidential and not sharing access",
                  "Reporting any suspected fraud, data breaches, or platform anomalies promptly",
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

          {/* Section 5 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                5. Prohibited Actions
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-3">
              <p>The following actions are strictly prohibited on StudElect:</p>
              <ul className="space-y-1.5">
                {[
                  "Impersonating another student, candidate, or administrator",
                  "Attempting to access, view, or use another student's voter PIN",
                  "Interfering with, disrupting, or attempting to compromise election systems or data",
                  "Submitting fraudulent voter registration data",
                  "Reverse engineering, scraping, or unauthorised data extraction from the platform",
                  "Using automated tools or bots to interact with the voter portal",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 p-3 rounded-lg border border-zinc-200 bg-zinc-50">
                <p className="text-xs font-semibold text-zinc-700">
                  Violations may result in permanent platform bans, institution
                  referral, and where applicable, legal proceedings under Nigerian
                  law.
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
                6. Intellectual Property
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                The StudElect platform, including its cryptographic voting
                architecture, user interfaces, algorithms, and codebase, is
                proprietary and owned exclusively by StudElect Nigeria. All
                rights are reserved.
              </p>
              <p>
                No part of the platform may be reproduced, copied, or distributed
                without express written permission from StudElect.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 7 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                7. Limitation of Liability
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                StudElect provides the technical infrastructure for conducting
                student elections. We are not liable for:
              </p>
              <ul className="space-y-1.5 mt-2">
                {[
                  "Institutional decisions made based on election results",
                  "Disputes arising from candidate eligibility screening decisions made by ELCOM",
                  "Consequences of inaccurate voter roll data submitted by an institution",
                  "Election results that are contested on grounds unrelated to platform integrity",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-300 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3">
                To the maximum extent permitted by law, StudElect's total
                liability shall not exceed the licence fees paid by the
                institution in the preceding 12-month period.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 8 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                8. Governing Law
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                These Terms of Service are governed by and construed in
                accordance with the laws of the{" "}
                <span className="font-medium text-zinc-700">
                  Federal Republic of Nigeria
                </span>
                . Any disputes arising under these terms shall be subject to the
                exclusive jurisdiction of Nigerian courts.
              </p>
            </div>
          </section>

          <div className="border-t border-zinc-100" />

          {/* Section 9 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
                9. Contact
              </h2>
            </div>
            <div className="text-sm text-zinc-500 leading-relaxed pl-6 space-y-2">
              <p>
                For legal enquiries, contract matters, or questions about these
                Terms, please contact:
              </p>
              <p className="font-mono text-xs text-zinc-400">
                <a
                  href="mailto:legal@studelect.com.ng"
                  className="text-zinc-600 hover:text-zinc-900 transition"
                >
                  legal@studelect.com.ng
                </a>
              </p>
            </div>
          </section>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-6 border-t border-zinc-100">
          <p className="text-[11px] text-zinc-400 text-center font-mono">
            StudElect Nigeria · studelect.com.ng · Governed by Nigerian Law
          </p>
        </div>
      </div>
    </div>
  );
}
