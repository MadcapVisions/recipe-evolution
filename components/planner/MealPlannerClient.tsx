"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import type { PlannerRecipeOption } from "@/lib/plannerData";
import { buildMealPlan } from "@/lib/recipes/mealPlanner";
import { formatGroceryItemDisplay } from "@/lib/recipes/servings";
import { downloadTextFile, shareOrFallback } from "@/lib/exportText";
import { ServingsControl } from "@/components/ServingsControl";

function prepSection(title: string, items: string[], empty: string) {
  return { title, items: items.slice(0, 3), empty };
}

export function MealPlannerClient({
  recipeOptions,
  pantryStaples,
  initialSelectedRecipeIds = [],
  initialSelectedVersionIds = [],
}: {
  recipeOptions: PlannerRecipeOption[];
  pantryStaples: string[];
  initialSelectedRecipeIds?: string[];
  initialSelectedVersionIds?: string[];
}) {
  const defaultSelectedVersionIds = useMemo(() => {
    const selected = new Set<string>();

    for (const option of recipeOptions) {
      if (initialSelectedVersionIds.includes(option.versionId) || initialSelectedRecipeIds.includes(option.recipeId)) {
        selected.add(option.versionId);
      }
    }

    if (selected.size > 0) {
      return [...selected];
    }

    return [];
  }, [initialSelectedRecipeIds, initialSelectedVersionIds, recipeOptions]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>(defaultSelectedVersionIds);
  const [targetServingsByVersion, setTargetServingsByVersion] = useState<Record<string, number>>(
    Object.fromEntries(recipeOptions.map((item) => [item.versionId, item.targetServings ?? item.servings ?? 1]))
  );
  const [modalText, setModalText] = useState<string | null>(null);

  const selectedRecipes = useMemo(
    () =>
      recipeOptions
        .filter((item) => selectedVersionIds.includes(item.versionId))
        .map((item) => ({
          ...item,
          targetServings: targetServingsByVersion[item.versionId] ?? item.servings,
        })),
    [recipeOptions, selectedVersionIds, targetServingsByVersion]
  );
  const plan = useMemo(() => buildMealPlan(selectedRecipes, pantryStaples), [pantryStaples, selectedRecipes]);

  const toggleRecipe = (versionId: string) => {
    setSelectedVersionIds((current) => (current.includes(versionId) ? current.filter((id) => id !== versionId) : [...current, versionId]));
  };

  const plannerText = useMemo(() => {
    const grocerySections = plan.groceryPlan.groupedItems.map((group) =>
      [
        group.aisle,
        ...group.items.map((item) => {
          const formatted = formatGroceryItemDisplay(item);
          return formatted.primary;
        }),
      ].join("\n")
    );
    if (plan.groceryPlan.flexibleItems.length > 0) {
      grocerySections.push(["Flexible items", ...plan.groceryPlan.flexibleItems.map((item) => formatGroceryItemDisplay(item).primary)].join("\n"));
    }
    const prepSections = plan.prepPlans.map((entry) =>
      [`${entry.recipeTitle} (${entry.versionLabel?.trim() || "Latest version"})`, ...entry.prepPlan.checklist.map((item) => `- ${item.title}`)].join("\n")
    );
    return [
      `Meal plan for ${plan.recipeCount} recipe${plan.recipeCount === 1 ? "" : "s"}`,
      "",
      "Combined grocery",
      ...grocerySections,
      "",
      "Prep plan",
      ...prepSections,
    ].join("\n");
  }, [plan]);

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(plannerText);
    } catch {
      setModalText(plannerText);
    }
  };

  const sharePlan = async () => {
    await shareOrFallback("Meal Plan", plannerText, () => setModalText(plannerText));
  };

  const exportPlan = () => {
    downloadTextFile("meal-plan.txt", plannerText);
  };

  const printPlan = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="artifact-sheet p-4 sm:p-5">
        <p className="app-kicker">Meal planning</p>
        <h1 className="mt-2 max-w-[14ch] font-display text-[24px] font-semibold tracking-tight text-[color:var(--text)] min-[380px]:text-[26px] sm:text-[30px]">
          Orchestrate a week from recipes you have already developed.
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-[color:var(--muted)]">
          Pick a few versions and Recipe Evolution will combine grocery, prep, and serving logic into one kitchen plan.
        </p>
        {defaultSelectedVersionIds.length > 0 ? (
          <p className="mt-3 rounded-[18px] border border-[rgba(74,106,96,0.1)] bg-[rgba(74,106,96,0.05)] px-4 py-3 text-sm text-[color:var(--text)]">
            Started with {defaultSelectedVersionIds.length} preselected recipe{defaultSelectedVersionIds.length === 1 ? "" : "s"} from your previous screen.
          </p>
        ) : null}
        <div className="mt-4 space-y-2.5">
          {recipeOptions.map((option) => {
            const active = selectedVersionIds.includes(option.versionId);
            return (
              <button
                key={option.versionId}
                type="button"
                onClick={() => toggleRecipe(option.versionId)}
                className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                  active
                    ? "border-[rgba(74,106,96,0.2)] bg-[rgba(250,249,244,0.98)] shadow-[inset_4px_0_0_var(--primary),0_10px_18px_rgba(58,84,76,0.06)]"
                    : "border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.9)]"
                }`}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.88)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                    {option.versionLabel?.trim() || "Latest version"}
                  </span>
                  {active ? (
                    <span className="rounded-full border border-[rgba(74,106,96,0.12)] bg-[rgba(74,106,96,0.08)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary-strong)]">
                      In plan
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[18px] font-semibold leading-7 text-[color:var(--text)]">{option.recipeTitle}</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  Serves {targetServingsByVersion[option.versionId] ?? option.servings ?? "-"}
                </p>
                {active ? (
                  <div className="mt-3 border-t border-[rgba(57,52,43,0.08)] pt-3" onClick={(event) => event.stopPropagation()}>
                    <ServingsControl
                      label="Plan for"
                      baseServings={option.servings}
                      targetServings={targetServingsByVersion[option.versionId] ?? option.servings ?? 1}
                      onChange={(value) =>
                        setTargetServingsByVersion((current) => ({
                          ...current,
                          [option.versionId]: value,
                        }))
                      }
                    />
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="space-y-5">
        <div className="artifact-sheet p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="app-kicker">Summary</p>
              <h2 className="mt-2 font-display text-[24px] font-semibold tracking-tight text-[color:var(--text)] min-[380px]:text-[26px] sm:text-[28px]">
                {plan.recipeCount} recipe{plan.recipeCount === 1 ? "" : "s"} in this plan
              </h2>
            </div>
            <Button href="/recipes" variant="secondary" className="min-h-11 self-start">
              Back to cookbook
            </Button>
          </div>
          {plan.recipeCount === 0 ? (
            <p className="mt-4 text-[15px] text-[color:var(--muted)]">
              Select one or more versions to build a combined grocery list and prep plan.
            </p>
          ) : null}
          {plan.recipeCount > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button onClick={copyPlan} variant="secondary" className="w-full sm:w-auto">
                Copy plan
              </Button>
              <Button onClick={sharePlan} variant="secondary" className="w-full sm:w-auto">
                Share plan
              </Button>
              <Button onClick={exportPlan} variant="secondary" className="w-full sm:w-auto">
                Export TXT
              </Button>
              <Button onClick={printPlan} variant="secondary" className="w-full sm:w-auto">
                Print
              </Button>
            </div>
          ) : null}
        </div>

        <div className="artifact-sheet p-4 sm:p-5">
          <p className="app-kicker">Combined grocery</p>
          <div className="mt-4 space-y-5">
            {plan.groceryPlan.groupedItems.map((group) => (
              <section key={group.aisle} className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.8)] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted)]">{group.aisle}</h3>
                <div className="mt-2 space-y-1.5">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[16px] border border-[rgba(57,52,43,0.06)] bg-[rgba(250,248,242,0.92)] px-4 py-2.5 text-sm text-[color:var(--text)]"
                    >
                      <p>{formatGroceryItemDisplay(item).primary}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {plan.groceryPlan.flexibleItems.length > 0 ? (
              <section className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.8)] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted)]">Flexible items</h3>
                <div className="mt-2 space-y-1.5">
                  {plan.groceryPlan.flexibleItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[16px] border border-[rgba(57,52,43,0.05)] bg-[rgba(255,253,249,0.92)] px-4 py-2.5 text-sm text-[color:var(--text)]"
                    >
                      {formatGroceryItemDisplay(item).primary}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {plan.groceryPlan.pantryItems.length > 0 ? (
              <section className="rounded-[22px] border border-[rgba(74,106,96,0.08)] bg-[rgba(247,250,248,0.84)] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted)]">Already stocked</h3>
                <div className="mt-2 space-y-1.5">
                  {plan.groceryPlan.pantryItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[16px] border border-[rgba(74,106,96,0.08)] bg-[rgba(74,106,96,0.06)] px-4 py-2.5 text-sm text-[color:var(--text)]"
                    >
                      {formatGroceryItemDisplay(item).primary}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {plan.prepPlans.map((entry) => (
            <section key={entry.versionId} className="artifact-sheet p-4 sm:p-5">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]">Prep summary</p>
              <h3 className="mt-2 text-[24px] font-semibold tracking-tight text-[color:var(--text)]">
                {entry.recipeTitle}
              </h3>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {entry.versionLabel?.trim() || "Latest version"}
              </p>
              <div className="annotation-note mt-4 px-4 py-3">
                <p className="font-annotate text-[17px] leading-7">Prep this like a recipe card, not a spreadsheet.</p>
              </div>
              <div className="mt-4 space-y-4">
                {[
                  prepSection("Start here", entry.prepPlan.firstMoves, "No immediate first moves detected."),
                  prepSection("Prep ahead", entry.prepPlan.prepTasks, "No ingredient prep detected."),
                  prepSection("Make ahead", entry.prepPlan.makeAheadTasks, "No make-ahead cues detected."),
                  prepSection("Open windows", entry.prepPlan.cookingWindows, "No longer waiting windows detected."),
                ].map((section) => (
                  <div key={section.title} className="artifact-sheet p-4">
                    <p className="text-sm font-semibold text-[color:var(--text)]">{section.title}</p>
                    {section.items.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {section.items.map((item) => (
                          <li
                            key={item}
                            className="rounded-[16px] border border-[rgba(57,52,43,0.06)] bg-[rgba(250,248,242,0.92)] px-4 py-2.5 text-sm leading-6 text-[color:var(--text)]"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[color:var(--muted)]">{section.empty}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {modalText ? (
          <div className="app-panel p-5">
            <p className="app-kicker">Manual copy</p>
            <textarea value={modalText} readOnly className="mt-3 min-h-48 w-full" />
            <div className="mt-3">
              <Button onClick={() => setModalText(null)} variant="secondary">
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
