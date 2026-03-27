import type { Metadata } from "next";
import { Dancing_Script } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "../styles/globals.css";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { AppShellClient } from "@/components/shell/AppShellClient";
import { canAccessAdmin } from "@/lib/auth/adminAccess";

export const metadata: Metadata = {
  title: "MealMaxer",
  description: "Develop better recipes over time with guided refinement, version history, and kitchen planning.",
  icons: {
    icon: "/assets/mealmaxer_icon.png",
  },
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
          { href: "/dashboard", label: "Create" },
          { href: "/recipes", label: "My Recipes" },
          { href: "/planner", label: "Weekly Planner" },
          { href: "/settings", label: "Settings" },
          ...(canAccessAdmin(user.email) ? [{ href: "/admin", label: "Admin" }] : []),
        ]
    : [
        { href: "/", label: "Home" },
        { href: "/pricing", label: "Pricing" },
      ];

  return (
    <html lang="en">
      <body className={`${dancingScript.variable} font-sans-ui text-slate-900`}>
        <AppShellClient
          navLinks={navLinks}
          userLabel={userLabel}
          userEmail={user?.email ?? null}
          showUserMenu={Boolean(user)}
        >
          {children}
        </AppShellClient>
        <Analytics />
      </body>
    </html>
  );
}
