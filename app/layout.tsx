import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "../styles/globals.css";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="font-sans-ui text-slate-900">
        <header className="sticky top-0 z-40 border-b border-[rgba(79,54,33,0.08)] bg-[rgba(246,241,232,0.78)] backdrop-blur-xl">
          <nav className="mx-auto flex h-24 w-full max-w-[1440px] items-center justify-between px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <Link href="/" className="inline-flex items-center">
                <Image
                  src="/assets/RE Logo png.png"
                  alt="Recipe Evolution"
                  width={460}
                  height={88}
                  priority
                  className="h-14 w-auto opacity-90"
                />
              </Link>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--muted)]">
              <Link
                href="/"
                className="rounded-full px-4 py-2.5 transition hover:bg-white/60 hover:text-[color:var(--text)]"
              >
                Home
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full px-4 py-2.5 transition hover:bg-white/60 hover:text-[color:var(--text)]"
              >
                Dashboard
              </Link>
              <Link
                href="/recipes"
                className="rounded-full px-4 py-2.5 transition hover:bg-white/60 hover:text-[color:var(--text)]"
              >
                All Recipes
              </Link>
              <Link
                href="/import"
                className="rounded-full px-4 py-2.5 transition hover:bg-white/60 hover:text-[color:var(--text)]"
              >
                Import Recipe
              </Link>
              {user ? (
                <UserMenu />
              ) : (
                <Link href="/sign-in" className="rounded-full px-4 py-2.5 transition hover:bg-white/60 hover:text-[color:var(--text)]">
                  Sign In
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="app-shell p-4 sm:p-6 lg:p-7">{children}</div>
        </main>
      </body>
    </html>
  );
}
