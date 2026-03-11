"use client";

import { SignOutButton } from "@/components/SignOutButton";

export function UserMenu() {
  return (
    <details className="relative">
      <summary className="flex h-11 w-11 list-none cursor-pointer items-center justify-center rounded-full border border-[rgba(79,54,33,0.14)] bg-[rgba(255,252,246,0.82)] text-sm font-semibold text-[color:var(--text)] shadow-[0_8px_18px_rgba(76,50,24,0.06)] transition hover:bg-white">
        U
      </summary>
      <div className="absolute right-0 z-20 mt-3 w-44 rounded-2xl border border-[rgba(79,54,33,0.12)] bg-[rgba(255,252,246,0.96)] p-2 shadow-[0_18px_40px_rgba(76,50,24,0.12)] backdrop-blur-xl">
        <SignOutButton />
      </div>
    </details>
  );
}
