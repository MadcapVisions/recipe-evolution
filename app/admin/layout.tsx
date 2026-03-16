import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { canAccessAdmin } from "@/lib/auth/adminAccess";

const adminLinks = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/ai", label: "AI settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!canAccessAdmin(user.email)) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-7xl page-shell space-y-8">
      <div className="space-y-3">
        <p className="app-kicker">Admin</p>
        <h1 className="page-title">Site administration</h1>
        <p className="max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
          Manage platform operations, AI settings, account visibility, and high-level usage from one dedicated admin workspace.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="saas-card h-fit space-y-3 p-4 xl:sticky xl:top-32">
          <p className="app-kicker">Admin nav</p>
          <nav className="space-y-2">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.78)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(74,106,96,0.22)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
