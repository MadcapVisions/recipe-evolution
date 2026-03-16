import Image from "next/image";
import { redirect } from "next/navigation";
import { canAccessAdmin } from "@/lib/auth/adminAccess";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { signVersionPhotoUrls } from "@/lib/versionPhotoUrls";
import { readCanonicalIngredients } from "@/lib/recipes/canonicalRecipe";
import { resolveStockRecipeCover } from "@/lib/stockRecipeCovers";

type RecipeDebugRow = {
  id: string;
  title: string;
  tags: string[];
  uploadedCoverUrl: string | null;
  stockCoverUrl: string | null;
  stockBucket: string;
  stockScore: number;
  stockReasons: string[];
  ingredientNames: string[];
};

export default async function StockCoversDebugPage() {
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

  const { data: recipes, error: recipesError } = await supabase
    .from("recipes")
    .select("id, title, tags, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (recipesError) {
    return <p className="text-sm text-red-700">Could not load recipes: {recipesError.message}</p>;
  }

  const recipeIds = (recipes ?? []).map((recipe) => recipe.id);
  const { data: versions, error: versionsError } = recipeIds.length
    ? await supabase
        .from("recipe_versions")
        .select("id, recipe_id, version_number, ingredients_json")
        .in("recipe_id", recipeIds)
        .order("version_number", { ascending: false })
    : { data: [], error: null };

  if (versionsError) {
    return <p className="text-sm text-red-700">Could not load versions: {versionsError.message}</p>;
  }

  const latestVersionByRecipe = new Map<string, (typeof versions)[number]>();
  for (const version of versions ?? []) {
    if (!latestVersionByRecipe.has(version.recipe_id)) {
      latestVersionByRecipe.set(version.recipe_id, version);
    }
  }

  const versionIds = (versions ?? []).map((version) => version.id);
  const { data: photos, error: photosError } = versionIds.length
    ? await supabase
        .from("version_photos")
        .select("version_id, storage_path, created_at")
        .in("version_id", versionIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (photosError) {
    return <p className="text-sm text-red-700">Could not load version photos: {photosError.message}</p>;
  }

  const versionToRecipe = new Map<string, string>();
  for (const version of versions ?? []) {
    versionToRecipe.set(version.id, version.recipe_id);
  }

  const firstPhotoPathByRecipe = new Map<string, string>();
  for (const photo of photos ?? []) {
    const recipeId = versionToRecipe.get(photo.version_id);
    if (!recipeId || firstPhotoPathByRecipe.has(recipeId)) {
      continue;
    }
    firstPhotoPathByRecipe.set(recipeId, photo.storage_path);
  }

  const signedCoverPhotos = firstPhotoPathByRecipe.size
    ? await signVersionPhotoUrls(
        supabase,
        [...firstPhotoPathByRecipe.entries()].map(([recipeId, storagePath]) => ({
          id: recipeId,
          storage_path: storagePath,
        }))
      )
    : [];

  const uploadedCoverUrlByRecipe = new Map<string, string>();
  for (const photo of signedCoverPhotos) {
    uploadedCoverUrlByRecipe.set(photo.id, photo.signedUrl);
  }

  const rows: RecipeDebugRow[] = (recipes ?? []).map((recipe) => {
    const latestVersion = latestVersionByRecipe.get(recipe.id);
    const ingredientNames = latestVersion ? readCanonicalIngredients(latestVersion.ingredients_json).map((item) => item.name) : [];
    const match = resolveStockRecipeCover({
      recipeId: recipe.id,
      title: recipe.title,
      tags: recipe.tags ?? [],
      ingredientNames,
    });

    return {
      id: recipe.id,
      title: recipe.title,
      tags: recipe.tags ?? [],
      uploadedCoverUrl: uploadedCoverUrlByRecipe.get(recipe.id) ?? null,
      stockCoverUrl: match.coverUrl,
      stockBucket: match.bucket,
      stockScore: match.score,
      stockReasons: match.reasons,
      ingredientNames,
    };
  });

  return (
    <div className="mx-auto max-w-7xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Debug</p>
        <h1 className="page-title">Stock Cover Preview</h1>
        <p className="max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
          Review how each recipe resolves to a stock cover. Uploaded photos still win; this page shows both the uploaded cover and the stock fallback match.
        </p>
      </div>

      <section className="saas-card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Recipes checked" value={String(rows.length)} />
          <StatCard label="Uploaded covers" value={String(rows.filter((row) => row.uploadedCoverUrl).length)} />
          <StatCard label="Stock matches" value={String(rows.filter((row) => row.stockCoverUrl).length)} />
          <StatCard label="Generic fallbacks" value={String(rows.filter((row) => row.stockBucket === "generic").length)} />
        </div>
      </section>

      <section className="space-y-4">
        {rows.map((row) => (
          <article key={row.id} className="saas-card p-5">
            <div className="flex flex-col gap-5 xl:flex-row">
              <div className="min-w-0 flex-1">
                <p className="text-[22px] font-semibold tracking-tight text-[color:var(--text)]">{row.title}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge label={`bucket: ${row.stockBucket}`} />
                  <Badge label={`score: ${row.stockScore}`} />
                  {row.uploadedCoverUrl ? <Badge label="uploaded cover present" /> : <Badge label="using stock fallback" />}
                  {(row.tags ?? []).map((tag) => (
                    <Badge key={tag} label={tag} />
                  ))}
                </div>
                {row.stockReasons.length > 0 ? (
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    Match reasons: {row.stockReasons.join(", ")}
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">No strong keyword match. Using generic fallback.</p>
                )}
                {row.ingredientNames.length > 0 ? (
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    Ingredients sampled: {row.ingredientNames.slice(0, 8).join(", ")}
                    {row.ingredientNames.length > 8 ? "..." : ""}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:w-[520px]">
                <CoverPreview title="Uploaded cover" src={row.uploadedCoverUrl} />
                <CoverPreview title="Stock match" src={row.stockCoverUrl} />
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-[rgba(141,169,187,0.08)] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-[32px] font-semibold text-[color:var(--text)]">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)]">{label}</span>;
}

function CoverPreview({ title, src }: { title: string; src: string | null }) {
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{title}</p>
      {src ? (
        <Image
          src={src}
          alt={title}
          width={640}
          height={480}
          unoptimized
          className="aspect-[4/3] w-full rounded-[22px] border border-[rgba(57,75,70,0.08)] object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.92)] text-sm text-[color:var(--muted)]">
          None
        </div>
      )}
    </div>
  );
}
