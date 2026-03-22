import { getAdminDashboardData } from "@/lib/admin/adminData";

export default async function AdminAccountsPage() {
  const data = await getAdminDashboardData();

  return (
    <section className="saas-card space-y-5 p-5">
      <div>
        <p className="app-kicker">Accounts</p>
        <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Users and membership</h2>
        <p className="mt-2 max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
          Review the accounts in the system, see who has admin access, and understand which users are actually creating recipes and using Chef.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[rgba(57,52,43,0.08)] text-[color:var(--muted)]">
              <th className="px-3 py-3 font-semibold">User</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 font-semibold">Recipes</th>
              <th className="px-3 py-3 font-semibold">Versions</th>
              <th className="px-3 py-3 font-semibold">AI prompts</th>
              <th className="px-3 py-3 font-semibold">AI cost</th>
              <th className="px-3 py-3 font-semibold">Joined</th>
              <th className="px-3 py-3 font-semibold">Last sign in</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((account) => (
              <tr key={account.id} className="border-b border-[rgba(57,52,43,0.06)] align-top">
                <td className="px-3 py-4">
                  <p className="font-semibold text-[color:var(--text)]">{account.displayName}</p>
                  <p className="mt-1 text-[color:var(--muted)]">{account.email ?? "No email"}</p>
                </td>
                <td className="px-3 py-4">
                  <span className="rounded-full bg-[rgba(74,106,96,0.08)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary-strong)]">
                    {account.isAdmin ? "Admin" : "Member"}
                  </span>
                </td>
                <td className="px-3 py-4 text-[color:var(--text)]">{account.recipeCount}</td>
                <td className="px-3 py-4 text-[color:var(--text)]">{account.versionCount}</td>
                <td className="px-3 py-4 text-[color:var(--text)]">{account.conversationCount}</td>
                <td className="px-3 py-4 font-mono text-[color:var(--text)]">
                  {account.aiCostUsd > 0 ? `$${account.aiCostUsd.toFixed(4)}` : "—"}
                </td>
                <td className="px-3 py-4 text-[color:var(--muted)]">{account.createdAt ? new Date(account.createdAt).toLocaleDateString() : "-"}</td>
                <td className="px-3 py-4 text-[color:var(--muted)]">{account.lastSignInAt ? new Date(account.lastSignInAt).toLocaleString() : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
