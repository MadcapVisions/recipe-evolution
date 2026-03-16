import { getAdminDashboardData } from "@/lib/admin/adminData";

export default async function AdminUsagePage() {
  const data = await getAdminDashboardData();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <UsageCard label="Home hub prompts" value={data.usage.homeHubPrompts} detail="dashboard Chef prompts" />
        <UsageCard label="Recipe detail prompts" value={data.usage.recipeDetailPrompts} detail="recipe refinement prompts" />
        <UsageCard label="Recipes / user" value={data.usage.recipesPerUser} detail="average library depth" />
        <UsageCard label="Versions / recipe" value={data.usage.versionsPerRecipe} detail="average refinement depth" />
      </section>

      <section className="saas-card space-y-5 p-5">
        <div>
          <p className="app-kicker">Usage breakdown</p>
          <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Product activity at a glance</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] p-4">
            <p className="text-[18px] font-semibold text-[color:var(--text)]">Recipe creation depth</p>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
              <li>Total users: {data.overview.totalUsers}</li>
              <li>Total recipes: {data.overview.totalRecipes}</li>
              <li>Total versions: {data.overview.totalVersions}</li>
              <li>Average versions per recipe: {data.usage.versionsPerRecipe}</li>
            </ul>
          </div>

          <div className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] p-4">
            <p className="text-[18px] font-semibold text-[color:var(--text)]">AI interaction mix</p>
            <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
              <li>Total prompts: {data.overview.totalAiPrompts}</li>
              <li>Home hub prompts: {data.usage.homeHubPrompts}</li>
              <li>Recipe detail prompts: {data.usage.recipeDetailPrompts}</li>
              <li>Prompt/response pairs are captured from `ai_conversation_turns`.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function UsageCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] bg-[rgba(255,252,246,0.92)] p-5 shadow-[0_8px_18px_rgba(76,50,24,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-4 font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{value}</p>
      <p className="mt-3 text-sm text-[color:var(--muted)]">{detail}</p>
    </div>
  );
}
