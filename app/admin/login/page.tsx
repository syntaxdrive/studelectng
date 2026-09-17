"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { CANONICAL_INSTITUTIONS } from "@/lib/db/institutions";
import {
  Lock,
  ArrowRight,
  ShieldCheck,
  Building2,
  AlertCircle,
  Key,
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [selectedCampus, setSelectedCampus] = useState("unilag");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await loginAction({ email: email.trim(), password });
    setIsLoading(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    if (res.role === "SUPER_ADMIN") {
      router.push("/super-admin");
    } else {
      router.push(`/${res.institutionSlug || selectedCampus}/admin`);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <div className="text-center space-y-2">
        <div className="h-10 w-10 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold mx-auto text-sm">
          SE
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">Administrator Sign In</h1>
        <p className="text-xs text-zinc-500">
          Sign in to your university ELCOM or Platform Super Admin dashboard.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4 text-xs">
        {error && (
          <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Select Your Campus
            </label>
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
            >
              {CANONICAL_INSTITUTIONS.map((inst) => (
                <option key={inst.slug} value={inst.slug}>
                  {inst.name} ({inst.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Official Email Address or Matric No
            </label>
            <input
              type="text"
              placeholder="e.g. elcom@ui.edu.ng or Matric No (e.g. 219080)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-medium"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase text-zinc-700 mb-1">
              Password or Voter PIN
            </label>
            <input
              type="password"
              placeholder="Password or Voter PIN"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 focus:ring-1 focus:ring-zinc-900 focus:outline-none font-mono"
              required
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Promoted Polling Agents &amp; ELCOM Officers can sign in using their Matric Number &amp; Voter Access PIN, or password (<code>elcom2026</code>).
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold transition flex items-center justify-center gap-2 text-xs shadow-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isLoading ? "Authenticating..." : "Sign In to Dashboard"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
