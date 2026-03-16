import type { Metadata } from "next";
import Image from "next/image";
import { Dancing_Script } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "../styles/globals.css";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { AiStatusBadge } from "@/components/AiStatusBadge";
import { UserMenu } from "@/components/UserMenu";

export const metadata: Metadata = {
  title: "Recipe Evolution",
  description: "Develop better recipes over time with guided refinement, version history, and kitchen planning.",
};

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-annotate-script",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const aiStatusLabel = "Chef available";

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
  const navLinks = user
    ? [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/recipes", label: "Cookbook" },
        { href: "/planner", label: "Meal Plan" },
        { href: "/import", label: "Import Recipe" },
        { href: "/settings", label: "Settings" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/pricing", label: "Pricing" },
      ];
  const mobileNavColumns = navLinks.length >= 5 ? "grid-cols-3" : navLinks.length === 4 ? "grid-cols-2" : "grid-cols-2";

  return (
    <html lang="en">
      <body className={`${dancingScript.variable} font-sans-ui text-slate-900`}>
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(79,54,33,0.08)] bg-[linear-gradient(180deg,rgba(248,243,234,0.95)_0%,rgba(245,239,229,0.88)_100%)] backdrop-blur-lg">
          <nav className="mx-auto w-full max-w-[1440px] px-4 py-3 sm:px-6 lg:flex lg:min-h-20 lg:items-center lg:gap-3 lg:px-10 lg:py-2">
            <div className="flex items-center justify-between gap-3 lg:contents">
              <a href="/" className="inline-flex shrink-0 items-center">
                <Image
                  src="/assets/RE Logo png.png"
                  alt="Recipe Evolution"
                  width={460}
                  height={88}
                  priority
                  className="h-[2.35rem] w-auto opacity-90 min-[380px]:h-[2.6rem] sm:h-[3.25rem] lg:h-[4.5rem]"
                />
              </a>
              <div className="flex shrink-0 items-center gap-2 lg:hidden">
                <div className="hidden min-[420px]:block lg:hidden">
                  <AiStatusBadge defaultMessage={aiStatusLabel} />
                </div>
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

            <div className="mt-3 min-[420px]:hidden lg:hidden">
              <AiStatusBadge defaultMessage={aiStatusLabel} />
            </div>

            <div className="mt-3 lg:mt-0 lg:ml-auto lg:overflow-visible">
              <div className={`grid ${mobileNavColumns} gap-2 text-[13px] font-semibold text-[color:var(--muted)] sm:flex sm:min-w-max sm:items-center sm:gap-2 sm:text-[15px] lg:min-w-0 lg:text-base`}>
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-full bg-white/36 px-3 py-2 text-center transition hover:bg-white/52 hover:text-[color:var(--text)] sm:bg-transparent lg:px-4"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="hidden lg:mx-auto lg:flex lg:flex-1 lg:justify-center">
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
        <main className="mx-auto w-full max-w-[1440px] px-3 pb-6 pt-48 min-[420px]:pt-40 sm:px-6 sm:pt-36 lg:px-10 lg:pb-8 lg:pt-26">
          <div className="app-shell animate-rise-in p-3 sm:p-6 lg:p-7">{children}</div>
        </main>
        <Analytics />
      </body>
    </html>
  );
}
