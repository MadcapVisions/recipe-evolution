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
          <nav className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-6 lg:flex lg:min-h-20 lg:items-center lg:gap-3 lg:px-10 lg:py-2">
            <div className="flex items-center justify-between gap-3">
              <a href="/" className="inline-flex items-center shrink-0">
                <Image
                  src="/assets/RE Logo png.png"
                  alt="Recipe Evolution"
                  width={460}
                  height={88}
                  priority
                  className="h-[3.2rem] w-auto opacity-90 sm:h-[3.5rem] lg:h-[4.5rem]"
                />
              </a>
              <div className="flex items-center gap-2 lg:hidden">
                {user ? (
                  <UserMenu label={userLabel} email={user.email ?? null} />
                ) : (
                  <a
                    href="/sign-in"
                    className="ui-btn ui-btn-light min-h-10 px-4 text-sm"
                  >
                    Sign In
                  </a>
                )}
              </div>
            </div>

            <div className="mt-3 overflow-x-auto lg:mt-0 lg:ml-auto lg:overflow-visible">
              <div className="flex min-w-max items-center gap-1.5 text-[15px] font-semibold text-[color:var(--muted)] sm:gap-2 sm:text-base lg:min-w-0">
                <a
                  href="/"
                  className="rounded-full px-3 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)] lg:px-4"
                >
                  Home
                </a>
                <a
                  href="/dashboard"
                  className="rounded-full px-3 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)] lg:px-4"
                >
                  Dashboard
                </a>
                <a
                  href="/recipes"
                  className="rounded-full px-3 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)] lg:px-4"
                >
                  All Recipes
                </a>
                <a
                  href="/import"
                  className="rounded-full px-3 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)] lg:px-4"
                >
                  Import Recipe
                </a>
                {!user ? (
                  <a
                    href="/pricing"
                    className="rounded-full px-3 py-2 transition hover:bg-white/60 hover:text-[color:var(--text)] lg:px-4"
                  >
                    Pricing
                  </a>
                ) : null}
              </div>
            </div>

            <div className="mt-3 lg:mx-auto lg:mt-0 lg:flex lg:flex-1 lg:justify-center">
              <AiStatusBadge defaultMessage={aiStatusLabel} />
            </div>

            <div className="hidden lg:flex lg:items-center lg:gap-2">
              {user ? (
                <UserMenu label={userLabel} email={user.email ?? null} />
              ) : (
                <a href="/sign-in" className="rounded-full px-4 py-2 text-base font-semibold text-[color:var(--muted)] transition hover:bg-white/60 hover:text-[color:var(--text)]">
                  Sign In
                </a>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 pb-6 pt-36 sm:px-6 sm:pt-40 lg:px-10 lg:pb-8 lg:pt-26">
          <div className="app-shell p-4 sm:p-6 lg:p-7">{children}</div>
        </main>
      </body>
    </html>
  );
}
