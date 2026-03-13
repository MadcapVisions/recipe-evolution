import type { Metadata } from "next";
import Image from "next/image";
import "../styles/globals.css";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { AiStatusBadge } from "@/components/AiStatusBadge";
import { UserMenu } from "@/components/UserMenu";

export const metadata: Metadata = {
  title: "Recipe Evolution",
  description: "Supabase auth starter",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const aiStatusLabel = "AI Chef Ready";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const metadata = user?.user_metadata;
  const resolvedName =
    metadata && typeof metadata.display_name === "string" && metadata.display_name.trim().length > 0
      ? metadata.display_name.trim()
      : metadata && typeof metadata.full_name === "string" && metadata.full_name.trim().length > 0
        ? metadata.full_name.trim()
        : [metadata?.first_name, metadata?.last_name]
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .map((value) => value.trim())
            .join(" ");
  const userLabel =
    resolvedName.length > 0
      ? resolvedName.charAt(0).toUpperCase()
      : user?.email?.trim().charAt(0).toUpperCase() ?? "U";

  return (
    <html lang="en">
      <body className="font-sans-ui text-slate-900">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(79,54,33,0.08)] bg-[rgba(246,241,232,0.86)] backdrop-blur-xl">
          <nav className="mx-auto flex min-h-20 w-full max-w-[1440px] flex-wrap items-center gap-2 px-5 py-2 lg:px-10">
            <div className="flex items-center gap-4">
              <a href="/" className="inline-flex items-center">
                <Image
                  src="/assets/RE Logo png.png"
                  alt="Recipe Evolution"
                  width={460}
                  height={88}
                  priority
                  className="h-[4.5rem] w-auto opacity-90"
                />
              </a>
            </div>
            <div className="hidden flex-1 justify-center lg:flex">
              <AiStatusBadge defaultMessage={aiStatusLabel} />
            </div>
            <div className="ml-auto flex items-center gap-2 text-base font-semibold text-[color:var(--muted)]">
              <a
                href="/"
                className="rounded-full px-4 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)]"
              >
                Home
              </a>
              <a
                href="/dashboard"
                className="rounded-full px-4 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)]"
              >
                Dashboard
              </a>
              <a
                href="/recipes"
                className="rounded-full px-4 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)]"
              >
                All Recipes
              </a>
              <a
                href="/import"
                className="rounded-full px-4 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)]"
              >
                Import Recipe
              </a>
              {user ? (
                <UserMenu label={userLabel} email={user.email ?? null} />
              ) : (
                <>
                  <a
                    href="/pricing"
                    className="rounded-full px-4 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)]"
                  >
                    Pricing
                  </a>
                  <a href="/sign-in" className="rounded-full px-4 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)]">
                    Sign In
                  </a>
                </>
              )}
            </div>
            <div className="w-full lg:hidden">
                <AiStatusBadge defaultMessage={aiStatusLabel} />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 pb-6 pt-22 sm:px-6 sm:pt-24 lg:px-10 lg:pb-8 lg:pt-24">
          <div className="app-shell p-4 sm:p-6 lg:p-7">{children}</div>
        </main>
      </body>
    </html>
  );
}
