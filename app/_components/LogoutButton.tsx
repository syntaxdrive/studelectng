"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Logout button that gives instant visual feedback:
 * - Immediately navigates to /admin/login (optimistic)
 * - Fires the server action in the background to clear the cookie
 * This eliminates the ~500–1200ms delay users felt waiting for
 * the server action to complete before any UI change happened.
 */
export default function LogoutButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleLogout() {
    // Optimistically navigate first — user sees the page change instantly
    router.push("/admin/login");
    // Then clear the session cookie server-side
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-600 transition flex-shrink-0 disabled:opacity-50"
      title="Sign Out"
    >
      <LogOut className={`w-4 h-4 ${isPending ? "animate-spin opacity-50" : ""}`} />
    </button>
  );
}
