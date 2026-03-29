import "server-only";

import { getAdminEmails } from "@/lib/auth/adminAccess";
import { resolveUsageCostUsd } from "@/lib/ai/usageMetrics";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type AuthUserRecord = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type RecipeRow = {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  id: string;
  recipe_id: string;
  version_number: number;
  created_at: string;
};

type ConversationRow = {
  id: string;
  owner_id: string;
  scope: "home_hub" | "recipe_detail";
  role: "user" | "assistant";
  created_at: string;
};

type UsageLogRow = {
  user_id: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
};

type GenerationAttemptCostRow = {
  owner_id: string;
  stage_metrics_json: Array<{
    estimated_cost_usd?: number | null;
  }> | null;
};

type AiTaskSettingRow = {
  task_key: string;
  primary_model: string;
  fallback_model: string | null;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
};

type CiaAdjudicationRow = {
  id: string;
  decision: string;
  adjudicator_source: string;
  created_at: string;
  updated_by?: string | null;
};

function formatDisplayName(user: AuthUserRecord) {
  const metadata = user.user_metadata ?? {};
  const displayName = typeof metadata.display_name === "string" ? metadata.display_name.trim() : "";
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name.trim() : "";
  if (displayName) return displayName;
  if (fullName) return fullName;
  return user.email ?? "Unknown user";
}

async function listUsers() {
  const admin = createSupabaseAdminClient();
  const users: AuthUserRecord[] = [];
  let page = 1;
  const perPage = 200;

  for (;;) {
    const result = await admin.auth.admin.listUsers({ page, perPage });
    if (result.error) {
      throw new Error(`Failed to load admin users: ${result.error.message}`);
    }

    const batch = (result.data.users ?? []) as AuthUserRecord[];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

export async function getAdminDashboardData() {
  const admin = createSupabaseAdminClient();

  const [users, recipesResult, versionsResult, conversationsResult, aiSettingsResult, usageLogResult, generationAttemptsResult, ciaResult] = await Promise.all([
    listUsers(),
    admin.from("recipes").select("id, owner_id, title, created_at, updated_at").order("created_at", { ascending: false }),
    admin.from("recipe_versions").select("id, recipe_id, version_number, created_at").order("created_at", { ascending: false }),
    admin.from("ai_conversation_turns").select("id, owner_id, scope, role, created_at").order("created_at", { ascending: false }),
    admin.from("ai_task_settings").select("task_key, primary_model, fallback_model, enabled, updated_at, updated_by").order("updated_at", { ascending: false }),
    admin.from("ai_usage_log").select("user_id, model, input_tokens, output_tokens, cost_usd"),
    admin.from("ai_generation_attempts").select("owner_id, stage_metrics_json"),
    admin.from("ai_cia_adjudications").select("id, decision, adjudicator_source, created_at").order("created_at", { ascending: false }),
  ]);

  if (recipesResult.error) throw new Error(`Failed to load recipes: ${recipesResult.error.message}`);
  if (versionsResult.error) throw new Error(`Failed to load recipe versions: ${versionsResult.error.message}`);
  if (conversationsResult.error) throw new Error(`Failed to load AI conversations: ${conversationsResult.error.message}`);
  if (aiSettingsResult.error) throw new Error(`Failed to load AI settings: ${aiSettingsResult.error.message}`);
  if (generationAttemptsResult.error) throw new Error(`Failed to load AI generation attempts: ${generationAttemptsResult.error.message}`);
  if (ciaResult.error) throw new Error(`Failed to load CIA adjudications: ${ciaResult.error.message}`);

  const recipes = (recipesResult.data ?? []) as RecipeRow[];
  const versions = (versionsResult.data ?? []) as VersionRow[];
  const conversations = (conversationsResult.data ?? []) as ConversationRow[];
  const aiSettings = (aiSettingsResult.data ?? []) as AiTaskSettingRow[];
  const usageLog = (usageLogResult.data ?? []) as UsageLogRow[];
  const generationAttempts = (generationAttemptsResult.data ?? []) as GenerationAttemptCostRow[];
  const ciaAdjudications = (ciaResult.data ?? []) as CiaAdjudicationRow[];

  const aiCostByUser = new Map<string, number>();
  for (const row of usageLog) {
    const resolvedCost = resolveUsageCostUsd(row);
    if (typeof resolvedCost === "number" && resolvedCost > 0) {
      aiCostByUser.set(row.user_id, (aiCostByUser.get(row.user_id) ?? 0) + resolvedCost);
    }
  }

  const generationCostByUser = new Map<string, number>();
  for (const row of generationAttempts) {
    const attemptCost = (row.stage_metrics_json ?? []).reduce(
      (sum, stage) => sum + (typeof stage.estimated_cost_usd === "number" ? stage.estimated_cost_usd : 0),
      0
    );
    if (attemptCost > 0) {
      generationCostByUser.set(row.owner_id, (generationCostByUser.get(row.owner_id) ?? 0) + attemptCost);
    }
  }

  const adminEmails = new Set(getAdminEmails());
  const userById = new Map(users.map((user) => [user.id, user]));
  const recipeOwnerByRecipeId = new Map(recipes.map((recipe) => [recipe.id, recipe.owner_id]));
  const recipeCountByUser = new Map<string, number>();
  const versionCountByUser = new Map<string, number>();
  const conversationCountByUser = new Map<string, number>();

  for (const recipe of recipes) {
    recipeCountByUser.set(recipe.owner_id, (recipeCountByUser.get(recipe.owner_id) ?? 0) + 1);
  }

  for (const version of versions) {
    const ownerId = recipeOwnerByRecipeId.get(version.recipe_id);
    if (!ownerId) continue;
    versionCountByUser.set(ownerId, (versionCountByUser.get(ownerId) ?? 0) + 1);
  }

  for (const conversation of conversations) {
    conversationCountByUser.set(conversation.owner_id, (conversationCountByUser.get(conversation.owner_id) ?? 0) + 1);
  }

  const accounts = users
    .map((user) => ({
      id: user.id,
      email: user.email,
      displayName: formatDisplayName(user),
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      isAdmin: user.email ? adminEmails.has(user.email.toLowerCase()) : false,
      recipeCount: recipeCountByUser.get(user.id) ?? 0,
      versionCount: versionCountByUser.get(user.id) ?? 0,
      conversationCount: conversationCountByUser.get(user.id) ?? 0,
      aiCostUsd: aiCostByUser.get(user.id) ?? generationCostByUser.get(user.id) ?? 0,
    }))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  const recentLogs = [
    ...recipes.slice(0, 12).map((recipe) => ({
      id: `recipe-${recipe.id}`,
      kind: "recipe_created",
      createdAt: recipe.created_at,
      title: recipe.title,
      detail: "Recipe created",
      actor: formatDisplayName(userById.get(recipe.owner_id) ?? { id: recipe.owner_id, email: null, created_at: null, last_sign_in_at: null }),
    })),
    ...versions.slice(0, 12).map((version) => {
      const ownerId = recipeOwnerByRecipeId.get(version.recipe_id) ?? "";
      const recipeTitle = recipes.find((item) => item.id === version.recipe_id)?.title ?? "Recipe";
      return {
        id: `version-${version.id}`,
        kind: "version_created",
        createdAt: version.created_at,
        title: recipeTitle,
        detail: `Version ${version.version_number} created`,
        actor: formatDisplayName(userById.get(ownerId) ?? { id: ownerId, email: null, created_at: null, last_sign_in_at: null }),
      };
    }),
    ...conversations
      .filter((conversation) => conversation.role === "user")
      .slice(0, 12)
      .map((conversation) => ({
        id: `conversation-${conversation.id}`,
        kind: "ai_prompt",
        createdAt: conversation.created_at,
        title: conversation.scope === "home_hub" ? "Dashboard Chef" : "Recipe Chef",
        detail: `AI prompt in ${conversation.scope === "home_hub" ? "home hub" : "recipe detail"}`,
        actor: formatDisplayName(userById.get(conversation.owner_id) ?? { id: conversation.owner_id, email: null, created_at: null, last_sign_in_at: null }),
      })),
    ...aiSettings.slice(0, 12).map((setting) => ({
      id: `ai-setting-${setting.task_key}`,
      kind: "ai_setting",
      createdAt: setting.updated_at,
      title: setting.task_key,
      detail: `AI routing updated to ${setting.primary_model}`,
      actor: setting.updated_by ? formatDisplayName(userById.get(setting.updated_by) ?? { id: setting.updated_by, email: null, created_at: null, last_sign_in_at: null }) : "System",
    })),
    ...ciaAdjudications.slice(0, 12).map((entry) => ({
      id: `cia-${entry.id}`,
      kind: "cia_adjudication",
      createdAt: entry.created_at,
      title: "CIA adjudication",
      detail: `${entry.decision} via ${entry.adjudicator_source}`,
      actor: "CIA",
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 24);

  const totalAiCostUsd = accounts.reduce((sum, account) => sum + account.aiCostUsd, 0);

  const overview = {
    totalUsers: users.length,
    adminUsers: accounts.filter((account) => account.isAdmin).length,
    totalRecipes: recipes.length,
    totalVersions: versions.length,
    totalAiPrompts: conversations.filter((conversation) => conversation.role === "user").length,
    totalAiResponses: conversations.filter((conversation) => conversation.role === "assistant").length,
    activeAiTasks: aiSettings.filter((setting) => setting.enabled).length,
    totalCiaRuns: ciaAdjudications.length,
    ciaSanitized: ciaAdjudications.filter((item) => item.decision === "sanitize_constraints").length,
    totalAiCostUsd,
  };

  const usage = {
    homeHubPrompts: conversations.filter((conversation) => conversation.role === "user" && conversation.scope === "home_hub").length,
    recipeDetailPrompts: conversations.filter((conversation) => conversation.role === "user" && conversation.scope === "recipe_detail").length,
    recipesPerUser: overview.totalUsers > 0 ? Number((overview.totalRecipes / overview.totalUsers).toFixed(1)) : 0,
    versionsPerRecipe: overview.totalRecipes > 0 ? Number((overview.totalVersions / overview.totalRecipes).toFixed(1)) : 0,
  };

  return {
    overview,
    usage,
    accounts,
    recentLogs,
    aiSettings: aiSettings.map((setting) => ({
      taskKey: setting.task_key,
      primaryModel: setting.primary_model,
      fallbackModel: setting.fallback_model,
      enabled: setting.enabled,
      updatedAt: setting.updated_at,
      updatedBy: setting.updated_by ? formatDisplayName(userById.get(setting.updated_by) ?? { id: setting.updated_by, email: null, created_at: null, last_sign_in_at: null }) : "System",
    })),
  };
}
