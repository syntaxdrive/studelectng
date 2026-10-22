"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

export default function LogoutButton() {
  const [isPending, setIsPending] = useState(false);

  return (
    <a
      href="/api/auth/logout?redirect=/admin/login"
      onClick={() => {
        setIsPending(true);
        try {
          sessionStorage.clear();
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith("studelect_") || key.includes("studelect"))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k));
        } catch (_) {}
      }}
      className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-600 transition flex-shrink-0"
      title="Sign Out"
    >
      <LogOut className={`w-4 h-4 ${isPending ? "animate-spin opacity-50" : ""}`} />
    </a>
  );
}
