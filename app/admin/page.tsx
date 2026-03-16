import Link from "next/link";
import { getAdminDashboardData } from "@/lib/admin/adminData";

export default async function AdminOverviewPage() {
  const data = await getAdminDashboardData();

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accounts" value={data.overview.totalUsers} detail={`${data.overview.adminUsers} admins`} tone="bg-[rgba(188,92,47,0.1)]" />
        <StatCard label="Recipes" value={data.overview.totalRecipes} detail={`${data.overview.totalVersions} versions`} tone="bg-[rgba(111,135,103,0.12)]" />
        <StatCard label="AI prompts" value={data.overview.totalAiPrompts} detail={`${data.overview.totalAiResponses} responses`} tone="bg-[rgba(141,169,187,0.12)]" />
        <StatCard label="AI tasks" value={data.overview.activeAiTasks} detail="currently enabled" tone="bg-[rgba(221,182,90,0.14)]" />
      </section>

      <section className="saas-card space-y-5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="app-kicker">Operations</p>
            <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Admin control center</h2>
            <p className="mt-2 max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
              Use this workspace to monitor account activity, understand product usage, inspect recent operational events, and manage AI routing.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminLinkCard href="/admin/accounts" title="Accounts" description="Inspect membership, sign-ins, and per-user recipe activity." />
          <AdminLinkCard href="/admin/usage" title="Usage" description="Track recipe, version, and AI prompt volume across the product." />
          <AdminLinkCard href="/admin/logs" title="Logs" description="Review recent creation events, AI activity, and admin changes." />
          <AdminLinkCard href="/admin/ai" title="AI settings" description="Adjust task routing and fallback model behavior." />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="saas-card space-y-4 p-5">
          <div>
            <p className="app-kicker">Recent activity</p>
            <h2 className="text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Latest system events</h2>
          </div>
          <div className="space-y-3">
            {data.recentLogs.slice(0, 8).map((entry) => (
              <div key={entry.id} className="rounded-[20px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold text-[color:var(--text)]">{entry.title}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{entry.kind.replaceAll("_", " ")}</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{entry.detail}</p>
                <p className="mt-2 text-xs text-[color:var(--muted)]">
                  {entry.actor} · {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="saas-card space-y-4 p-5">
          <div>
            <p className="app-kicker">AI routing</p>
            <h2 className="text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Current task models</h2>
          </div>
          <div className="space-y-3">
            {data.aiSettings.map((setting) => (
              <div key={setting.taskKey} className="rounded-[20px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold text-[color:var(--text)]">{setting.taskKey}</p>
                  <span className="rounded-full bg-[rgba(74,106,96,0.08)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary-strong)]">
                    {setting.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[color:var(--muted)]">Primary: {setting.primaryModel}</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">Fallback: {setting.fallbackModel ?? "None"}</p>
                <p className="mt-2 text-xs text-[color:var(--muted)]">Updated by {setting.updatedBy} · {new Date(setting.updatedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: string;
}) {
  return (
    <div className={`flex min-h-32 flex-col justify-between rounded-[24px] p-5 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <div>
        <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{value}</p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">{detail}</p>
      </div>
    </div>
  );
}

function AdminLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] p-4 transition hover:bg-white">
      <p className="text-[18px] font-semibold text-[color:var(--text)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{description}</p>
    </Link>
  );
}
