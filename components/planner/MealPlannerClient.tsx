"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { ShellContextPanel } from "@/components/shell/ShellContextPanel";
import { useAppShell } from "@/components/shell/AppShellContext";
import type { PlannerRecipeOption } from "@/lib/plannerData";
import { buildMealPlan } from "@/lib/recipes/mealPlanner";
import { formatGroceryItemDisplay } from "@/lib/recipes/servings";
import { downloadTextFile, shareOrFallback } from "@/lib/exportText";
import { ServingsControl } from "@/components/ServingsControl";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type PlannerFilter = "all" | "in-plan" | "available";
type PlannerTab = "week" | "groceries" | "prep";
type DayAssignment = {
  versionId: string;
  servings: number;
};
type WeekAssignments = Record<string, DayAssignment[]>;

function prepSection(title: string, items: string[], empty: string) {
  return { title, items: items.slice(0, 3), empty };
}

function matchesRecipe(option: PlannerRecipeOption, query: string) {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  return (
    option.recipeTitle.toLowerCase().includes(normalizedQuery) ||
    option.versionLabel?.toLowerCase().includes(normalizedQuery) ||
    option.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(normalizedQuery))
  );
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
  const { setOpenPanel } = useAppShell();
  const defaultSelectedVersionIds = useMemo(
    () =>
      recipeOptions
        .filter((option) => initialSelectedVersionIds.includes(option.versionId) || initialSelectedRecipeIds.includes(option.recipeId))
        .map((option) => option.versionId),
    [initialSelectedRecipeIds, initialSelectedVersionIds, recipeOptions]
  );
  const [leftSidebarMode, setLeftSidebarMode] = useState<"selection" | "summary">("selection");
  const [targetServingsByVersion, setTargetServingsByVersion] = useState<Record<string, number>>(
    Object.fromEntries(recipeOptions.map((item) => [item.versionId, item.targetServings ?? item.servings ?? 1]))
  );
  const [modalText, setModalText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [weekAssignments, setWeekAssignments] = useState<WeekAssignments>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [plannerFilter, setPlannerFilter] = useState<PlannerFilter>("all");
  const [focusedVersionId, setFocusedVersionId] = useState<string | null>(defaultSelectedVersionIds[0] ?? recipeOptions[0]?.versionId ?? null);
  const [draggingVersionId, setDraggingVersionId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [checkedGroceries, setCheckedGroceries] = useState<Record<string, boolean>>({});
  const [collapsedAisles, setCollapsedAisles] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<PlannerTab>("week");

  const recipeOptionsById = useMemo(() => new Map(recipeOptions.map((option) => [option.versionId, option])), [recipeOptions]);
  const allScheduledAssignments = useMemo(() => Object.values(weekAssignments).flat(), [weekAssignments]);
  const scheduledVersionIds = useMemo(() => new Set(allScheduledAssignments.map((assignment) => assignment.versionId)), [allScheduledAssignments]);

  const selectedRecipes = useMemo(
    () => {
      const servingsByVersion = new Map<string, number>();

      for (const assignment of allScheduledAssignments) {
        servingsByVersion.set(assignment.versionId, (servingsByVersion.get(assignment.versionId) ?? 0) + assignment.servings);
      }

      return Array.from(servingsByVersion.entries())
        .map(([versionId, totalServings]) => {
          const option = recipeOptionsById.get(versionId);
          if (!option) {
            return null;
          }

          return {
            ...option,
            targetServings: totalServings,
          } as PlannerRecipeOption;
        })
        .filter((value): value is PlannerRecipeOption => Boolean(value));
    },
    [allScheduledAssignments, recipeOptionsById]
  );
  const selectedRecipesById = useMemo(
    () => new Map(selectedRecipes.map((recipe) => [recipe.versionId, recipe])),
    [selectedRecipes]
  );
  const plan = useMemo(() => buildMealPlan(selectedRecipes, pantryStaples), [pantryStaples, selectedRecipes]);

  const assignedDayCount = useMemo(() => DAYS.filter((day) => (weekAssignments[day]?.length ?? 0) > 0).length, [weekAssignments]);
  const unassignedRecipeCount = Math.max(0, recipeOptions.length - scheduledVersionIds.size);

  const filteredRecipeOptions = useMemo(
    () =>
      recipeOptions.filter((option) => {
        const inPlan = scheduledVersionIds.has(option.versionId);
        if (plannerFilter === "in-plan" && !inPlan) {
          return false;
        }
        if (plannerFilter === "available" && inPlan) {
          return false;
        }
        return matchesRecipe(option, searchQuery);
      }),
    [plannerFilter, recipeOptions, scheduledVersionIds, searchQuery]
  );

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
    const weekSection = DAYS.map((day) => {
      const assignments = weekAssignments[day] ?? [];
      if (assignments.length === 0) {
        return `${day}: Open`;
      }

      const labels = assignments
        .map((assignment) => {
          const assignedRecipe = selectedRecipesById.get(assignment.versionId);
          return assignedRecipe ? `${assignedRecipe.recipeTitle} (${assignment.servings} servings)` : null;
        })
        .filter((value): value is string => Boolean(value));

      return `${day}: ${labels.join("; ")}`;
    });

    return [
      `Meal plan for ${plan.recipeCount} recipe${plan.recipeCount === 1 ? "" : "s"}`,
      "",
      "Week plan",
      ...weekSection,
      "",
      "Combined grocery",
      ...grocerySections,
      "",
      "Prep plan",
      ...prepSections,
    ].join("\n");
  }, [plan, selectedRecipesById, weekAssignments]);

  const isCompactViewport = () => (typeof window !== "undefined" ? window.innerWidth < 1280 : false);

  const openLeftPanelMode = (mode: "selection" | "summary") => {
    setLeftSidebarMode(mode);

    if (isCompactViewport()) {
      setOpenPanel("left");
    }
  };

  const addRecipe = (versionId: string) => {
    openLeftPanelMode("selection");
    setFocusedVersionId(versionId);
  };

  const removeRecipe = (versionId: string) => {
    openLeftPanelMode("selection");
    setWeekAssignments((existing) =>
      Object.fromEntries(
        Object.entries(existing)
          .map(([day, assignments]) => [day, assignments.filter((assignment) => assignment.versionId !== versionId)] as const)
          .filter(([, assignments]) => assignments.length > 0)
      )
    );
    setFocusedVersionId((current) => (current === versionId ? null : current));
  };

  const assignRecipeToDay = (day: string, versionId: string) => {
    setWeekAssignments((current) => ({
      ...current,
      [day]: [
        ...(current[day] ?? []).filter((assignment) => assignment.versionId !== versionId),
        {
          versionId,
          servings: targetServingsByVersion[versionId] ?? recipeOptionsById.get(versionId)?.servings ?? 1,
        },
      ],
    }));
    setFocusedVersionId(versionId);
  };

  const updateDayServings = (day: string, index: number, servings: number) => {
    setWeekAssignments((current) => {
      const assignments = current[day];
      if (!assignments?.[index]) {
        return current;
      }

      return {
        ...current,
        [day]: assignments.map((assignment, assignmentIndex) =>
          assignmentIndex === index
            ? {
                ...assignment,
                servings,
              }
            : assignment
        ),
      };
    });
  };

  const clearDayAssignment = (day: string, index: number) => {
    setWeekAssignments((current) => {
      const assignments = current[day];
      const assignmentToRemove = assignments?.[index];
      if (!assignments || !assignmentToRemove) {
        return current;
      }

      const next = { ...current };
      const remainingForDay = assignments.filter((_, assignmentIndex) => assignmentIndex !== index);
      if (remainingForDay.length > 0) {
        next[day] = remainingForDay;
      } else {
        delete next[day];
      }

      const stillScheduledElsewhere = Object.values(next)
        .flat()
        .some((assignment) => assignment.versionId === assignmentToRemove.versionId);
      if (!stillScheduledElsewhere) {
        setFocusedVersionId((focused) => (focused === assignmentToRemove.versionId ? null : focused));
      }

      return next;
    });
  };

  const handleDayClick = (day: string) => {
    if (focusedVersionId) {
      assignRecipeToDay(day, focusedVersionId);
      return;
    }
  };

  const copyPlan = async () => {
    openLeftPanelMode("summary");
    try {
      await navigator.clipboard.writeText(plannerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setModalText(plannerText);
    }
  };

  const sharePlan = async () => {
    openLeftPanelMode("summary");
    await shareOrFallback("Meal Plan", plannerText, () => setModalText(plannerText));
  };

  const exportPlan = () => {
    openLeftPanelMode("summary");
    downloadTextFile("meal-plan.txt", plannerText);
  };

  const printPlan = () => {
    openLeftPanelMode("summary");
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const mobilePanelContent =
    leftSidebarMode === "selection" ? (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.84)] p-4">
          <p className="app-kicker">Library</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            Search your saved recipes, adjust servings, then drag or tap them into the week.
          </p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search recipes or ingredients"
          />
          <button
            type="button"
            onClick={() =>
              setPlannerFilter((current) =>
                current === "all" ? "in-plan" : current === "in-plan" ? "available" : "all"
              )
            }
            className="ui-btn ui-btn-light px-3"
          >
            {plannerFilter === "all" ? "All" : plannerFilter === "in-plan" ? "In plan" : "Available"}
          </button>
        </div>
        <div className="space-y-2">
          {filteredRecipeOptions.map((option) => {
            const active = scheduledVersionIds.has(option.versionId);
            const focused = focusedVersionId === option.versionId;
            return (
              <div
                key={option.versionId}
                className={`rounded-[20px] border px-3 py-3 ${
                  focused ? "border-[rgba(210,76,47,0.22)] bg-[rgba(255,248,243,0.98)]" : "border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,248,0.9)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => setFocusedVersionId(option.versionId)} className="min-w-0 flex-1 text-left">
                    <p className="line-clamp-2 text-sm font-semibold text-[color:var(--text)]">{option.recipeTitle}</p>
                    <p className="mt-1 text-xs text-[color:var(--muted)]">Serves {targetServingsByVersion[option.versionId] ?? option.servings ?? "-"}</p>
                  </button>
                    <button
                      type="button"
                      onClick={() => (active ? removeRecipe(option.versionId) : addRecipe(option.versionId))}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        active ? "bg-[rgba(210,76,47,0.12)] text-[color:var(--primary-strong)]" : "border border-[rgba(57,75,70,0.1)] text-[color:var(--muted)]"
                      }`}
                    >
                      {active ? "Remove" : "Add"}
                    </button>
                </div>
                {active ? (
                  <ServingsControl
                    className="mt-3"
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
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.84)] p-4">
          <p className="app-kicker">Summary</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {plan.recipeCount} recipes selected, {assignedDayCount} of {DAYS.length} days assigned.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={copyPlan} variant="secondary" className="w-full">
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button onClick={sharePlan} variant="secondary" className="w-full">
            Share
          </Button>
          <Button onClick={exportPlan} variant="secondary" className="w-full">
            Download
          </Button>
          <Button onClick={printPlan} variant="secondary" className="w-full">
            Print
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-5">
      <ShellContextPanel
        side="left"
        label={leftSidebarMode === "selection" ? "Library" : "Summary"}
        title={leftSidebarMode === "selection" ? "Planner library" : "Planner summary"}
        description={
          leftSidebarMode === "selection"
            ? "Search your recipes, adjust servings, and add them to the weekly grid."
            : "Review assignment progress and export the finished plan."
        }
      >
        {mobilePanelContent}
      </ShellContextPanel>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <section className="artifact-sheet sticky top-6 flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden p-4">
            <div className="space-y-3">
              <div>
                <p className="app-kicker">Recipe library</p>
                <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-[color:var(--text)]">
                  Build the week by dragging recipes into each day.
                </h1>
              </div>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search recipes or ingredients"
                aria-label="Search recipe library"
              />
              <div className="grid grid-cols-3 gap-2">
                {([
                  ["all", "All"],
                  ["in-plan", "In plan"],
                  ["available", "Available"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPlannerFilter(value)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold ${
                      plannerFilter === value
                        ? "bg-[color:var(--primary)] text-white"
                        : "border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.92)] text-[color:var(--muted)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2 overflow-y-auto pr-1">
              {filteredRecipeOptions.map((option) => {
                const active = scheduledVersionIds.has(option.versionId);
                const focused = focusedVersionId === option.versionId;

                return (
                  <div
                    key={option.versionId}
                    draggable
                    onDragStart={(event) => {
                      if (event.target instanceof HTMLElement && event.target.closest("button, input, select, textarea, label")) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", option.versionId);
                      setDraggingVersionId(option.versionId);
                      if (!active) {
                        addRecipe(option.versionId);
                      }
                      setFocusedVersionId(option.versionId);
                    }}
                    onDragEnd={() => {
                      setDraggingVersionId(null);
                      setDragOverDay(null);
                    }}
                    className={`rounded-[22px] border px-3 py-3 transition ${
                      focused
                        ? "border-[rgba(210,76,47,0.2)] bg-[rgba(255,247,242,0.98)] shadow-[0_12px_22px_rgba(101,47,29,0.06)]"
                        : "border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,248,0.92)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button type="button" onClick={() => setFocusedVersionId(option.versionId)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                              active
                                ? "bg-[rgba(210,76,47,0.12)] text-[color:var(--primary-strong)]"
                                : "border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.88)] text-[color:var(--muted)]"
                            }`}
                          >
                            {active ? "In plan" : "Ready"}
                          </span>
                          {scheduledVersionIds.has(option.versionId) ? (
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--secondary)]">Scheduled</span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-[15px] font-semibold leading-6 text-[color:var(--text)]">{option.recipeTitle}</p>
                        <p className="mt-1 text-xs text-[color:var(--muted)]">
                          {targetServingsByVersion[option.versionId] ?? option.servings ?? "-"} servings
                          {option.versionLabel?.trim() ? ` · ${option.versionLabel}` : ""}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => (active ? removeRecipe(option.versionId) : addRecipe(option.versionId))}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                          active
                            ? "bg-[rgba(43,31,29,0.06)] text-[color:var(--text)]"
                            : "bg-[rgba(210,76,47,0.08)] text-[color:var(--primary-strong)]"
                        }`}
                      >
                        {active ? "Remove" : "Add"}
                      </button>
                    </div>
                    {active ? (
                      <div className="mt-3 border-t border-[rgba(57,52,43,0.08)] pt-3">
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
                  </div>
                );
              })}
              {filteredRecipeOptions.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.72)] px-4 py-6 text-sm text-[color:var(--muted)]">
                  No recipes match that search. Try a broader ingredient or switch the filter.
                </div>
              ) : null}
            </div>
          </section>
        </aside>

        <section className="space-y-5">
          <div className="artifact-sheet p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="app-kicker">Weekly planner</p>
                <h2 className="mt-2 font-display text-[30px] font-semibold tracking-tight text-[color:var(--text)]">
                  One workspace, one planning mode at a time.
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[280px]">
                <div className="flex min-h-[92px] flex-col justify-between rounded-[20px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.82)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Recipes</p>
                  <p className="mt-1 text-2xl font-semibold text-[color:var(--text)]">{plan.recipeCount}</p>
                </div>
                <div className="flex min-h-[92px] flex-col justify-between rounded-[20px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.82)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Days filled</p>
                  <p className="mt-1 text-2xl font-semibold text-[color:var(--text)]">{assignedDayCount}</p>
                </div>
                <div className="flex min-h-[92px] flex-col justify-between rounded-[20px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.82)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Open recipes</p>
                  <p className="mt-1 text-2xl font-semibold text-[color:var(--text)]">{unassignedRecipeCount}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-4 border-t border-[rgba(57,52,43,0.08)] pt-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["week", "Week"],
                    ["groceries", "Groceries"],
                    ["prep", "Prep"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setActiveTab(value)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        activeTab === value
                          ? "bg-[color:var(--primary)] text-white shadow-[0_10px_20px_rgba(182,63,41,0.18)]"
                          : "border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.92)] text-[color:var(--muted)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={copyPlan} variant="secondary" className="min-h-10 px-4">
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button onClick={sharePlan} variant="secondary" className="min-h-10 px-4">
                    Share
                  </Button>
                  <Button onClick={exportPlan} variant="secondary" className="min-h-10 px-4">
                    Download
                  </Button>
                  <Button onClick={printPlan} variant="secondary" className="min-h-10 px-4">
                    Print
                  </Button>
                </div>
              </div>

              {activeTab === "week" ? (
                <div className="space-y-5">
                  <div className="space-y-3">
                    {DAYS.map((day) => {
                      const assignments = weekAssignments[day] ?? [];
                      const dropActive = dragOverDay === day;

                      return (
                        <div
                          key={day}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragOverDay(day);
                          }}
                          onDragLeave={() => {
                            if (dragOverDay === day) {
                              setDragOverDay(null);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const versionId = event.dataTransfer.getData("text/plain") || draggingVersionId;
                            if (versionId) {
                              assignRecipeToDay(day, versionId);
                            }
                            setDragOverDay(null);
                            setDraggingVersionId(null);
                          }}
                          className={`rounded-[24px] border p-4 transition ${
                            dropActive
                              ? "border-[rgba(210,76,47,0.28)] bg-[rgba(255,244,238,0.96)] shadow-[0_12px_26px_rgba(182,63,41,0.08)]"
                              : "border-[rgba(57,75,70,0.08)] bg-[rgba(255,251,246,0.92)]"
                          }`}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 lg:w-[148px]">
                              <p className="text-[28px] font-semibold leading-none text-[color:var(--text)]">{day}</p>
                              <p className="mt-2 text-[12px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Dinner</p>
                            </div>

                            <div className="min-w-0 flex-1 space-y-3">
                              {assignments.map((assignment, assignmentIndex) => {
                                const assignedRecipeForDay = selectedRecipesById.get(assignment.versionId);
                                if (!assignedRecipeForDay) {
                                  return null;
                                }

                                const servingOptions = Array.from(
                                  new Set([
                                    1,
                                    Math.max(1, Math.round((assignedRecipeForDay.servings ?? 1) / 2)),
                                    assignedRecipeForDay.servings ?? 1,
                                    assignment.servings,
                                    2,
                                    3,
                                    4,
                                    5,
                                    6,
                                    8,
                                    10,
                                    12,
                                  ])
                                )
                                  .filter((value) => Number.isFinite(value) && value >= 1)
                                  .sort((left, right) => left - right);

                                return (
                                  <div
                                    key={`${day}-${assignment.versionId}-${assignmentIndex}`}
                                    className="flex min-h-[108px] w-full flex-col justify-between rounded-[18px] border border-[rgba(210,76,47,0.16)] bg-[rgba(210,76,47,0.08)] px-4 py-3 text-left"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="line-clamp-3 text-[18px] font-semibold leading-8 text-[color:var(--text)]">
                                          {assignedRecipeForDay.recipeTitle}
                                        </p>
                                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                                          {assignedRecipeForDay.versionLabel?.trim() || "Latest version"}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => clearDayAssignment(day, assignmentIndex)}
                                        className="rounded-full border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.92)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)]"
                                      >
                                        Clear
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-3 pt-3">
                                      <select
                                        value={assignment.servings}
                                        onChange={(event) => updateDayServings(day, assignmentIndex, Number(event.target.value) || 1)}
                                        className="min-h-10 min-w-[8.5rem] rounded-xl border bg-white px-3 text-sm font-semibold text-[color:var(--primary-strong)]"
                                      >
                                        {servingOptions.map((value) => (
                                          <option key={value} value={value}>
                                            {value} {value === 1 ? "serving" : "servings"}
                                          </option>
                                        ))}
                                      </select>
                                      <span className="text-sm text-[color:var(--muted)]">
                                        Base recipe serves {assignedRecipeForDay.servings ?? 1}.
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}

                              <button
                                type="button"
                                onClick={() => handleDayClick(day)}
                                className={`flex min-h-[108px] w-full items-center justify-between gap-4 rounded-[18px] border border-dashed px-4 py-3 text-left ${
                                  focusedVersionId
                                    ? "border-[rgba(210,76,47,0.16)] bg-[rgba(255,248,243,0.92)] text-[color:var(--text)]"
                                    : "border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.72)] text-[color:var(--muted)]"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-[17px] font-semibold leading-7 text-[color:var(--text)]">
                                    {focusedVersionId ? "Assign selected recipe" : assignments.length > 0 ? "Add another recipe" : "Drop a recipe here"}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                                    {focusedVersionId
                                      ? "Use the selected recipe from the library, or drag a different one onto this row."
                                      : "Choose a recipe in the library, then assign it to this day."}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.92)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)]">
                                  {focusedVersionId ? "Assign" : "Open"}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              ) : null}

              {activeTab === "groceries" ? (
                <div className="rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.82)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="app-kicker">Combined grocery</p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">
                          {plan.groceryPlan.groupedItems.reduce((sum, group) => sum + group.items.length, 0) + plan.groceryPlan.flexibleItems.length} items to shop
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCheckedGroceries({})}
                        className="rounded-full border border-[rgba(57,75,70,0.08)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)]"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="mt-4 max-h-[48rem] space-y-3 overflow-y-auto pr-1">
                      {plan.groceryPlan.groupedItems.map((group) => {
                        const isCollapsed = collapsedAisles[group.aisle] ?? false;
                        return (
                          <section key={group.aisle} className="rounded-[18px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,250,245,0.9)]">
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedAisles((current) => ({
                                  ...current,
                                  [group.aisle]: !isCollapsed,
                                }))
                              }
                              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                            >
                              <span>
                                <span className="block text-sm font-semibold text-[color:var(--text)]">{group.aisle}</span>
                                <span className="block text-xs text-[color:var(--muted)]">{group.items.length} items</span>
                              </span>
                              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                                {isCollapsed ? "Open" : "Hide"}
                              </span>
                            </button>
                            {!isCollapsed ? (
                              <div className="space-y-1 border-t border-[rgba(57,52,43,0.06)] px-3 py-2">
                                {group.items.map((item) => {
                                  const label = formatGroceryItemDisplay(item).primary;
                                  return (
                                    <label key={item.id} className="flex items-start gap-3 rounded-[14px] px-2 py-2 text-sm text-[color:var(--text)]">
                                      <button
                                        type="button"
                                        aria-pressed={checkedGroceries[item.id] ?? false}
                                        onClick={() =>
                                          setCheckedGroceries((current) => ({
                                            ...current,
                                            [item.id]: !current[item.id],
                                          }))
                                        }
                                        className={`mt-0.5 h-4 w-4 rounded-[5px] border p-0 ${
                                          checkedGroceries[item.id] ? "border-[color:var(--primary)] bg-[color:var(--primary)]" : "border-[rgba(57,75,70,0.16)] bg-white"
                                        }`}
                                      />
                                      <span className={checkedGroceries[item.id] ? "text-[color:var(--muted)] line-through" : undefined}>{label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : null}
                          </section>
                        );
                      })}

                      {plan.groceryPlan.flexibleItems.length > 0 ? (
                        <section className="rounded-[18px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,250,245,0.9)]">
                          <div className="px-3 py-3">
                            <span className="block text-sm font-semibold text-[color:var(--text)]">Flexible items</span>
                            <span className="block text-xs text-[color:var(--muted)]">{plan.groceryPlan.flexibleItems.length} items</span>
                          </div>
                          <div className="space-y-1 border-t border-[rgba(57,52,43,0.06)] px-3 py-2">
                            {plan.groceryPlan.flexibleItems.map((item) => {
                              const label = formatGroceryItemDisplay(item).primary;
                              return (
                                <label key={item.id} className="flex items-start gap-3 rounded-[14px] px-2 py-2 text-sm text-[color:var(--text)]">
                                  <button
                                    type="button"
                                    aria-pressed={checkedGroceries[item.id] ?? false}
                                    onClick={() =>
                                      setCheckedGroceries((current) => ({
                                        ...current,
                                        [item.id]: !current[item.id],
                                      }))
                                    }
                                    className={`mt-0.5 h-4 w-4 rounded-[5px] border p-0 ${
                                      checkedGroceries[item.id] ? "border-[color:var(--primary)] bg-[color:var(--primary)]" : "border-[rgba(57,75,70,0.16)] bg-white"
                                    }`}
                                  />
                                  <span className={checkedGroceries[item.id] ? "text-[color:var(--muted)] line-through" : undefined}>{label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </section>
                      ) : null}

                      {plan.groceryPlan.pantryItems.length > 0 ? (
                        <section className="rounded-[18px] border border-[rgba(74,106,96,0.08)] bg-[rgba(247,250,248,0.84)] px-3 py-3">
                          <span className="block text-sm font-semibold text-[color:var(--text)]">Already stocked</span>
                          <span className="mt-1 block text-xs text-[color:var(--muted)]">{plan.groceryPlan.pantryItems.length} pantry staples</span>
                          <div className="mt-2 space-y-1">
                            {plan.groceryPlan.pantryItems.map((item) => (
                              <p key={item.id} className="text-sm text-[color:var(--muted)]">
                                {formatGroceryItemDisplay(item).primary}
                              </p>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </div>
                </div>
              ) : null}

              {activeTab === "prep" ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {plan.prepPlans.map((entry) => (
                    <section key={entry.versionId} className="rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.82)] p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="app-kicker">Prep view</p>
                          <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-[color:var(--text)]">{entry.recipeTitle}</h3>
                          <p className="mt-1 text-sm text-[color:var(--muted)]">{entry.versionLabel?.trim() || "Latest version"}</p>
                        </div>
                        <span className="rounded-full bg-[rgba(210,76,47,0.08)] px-3 py-1 text-xs font-semibold text-[color:var(--primary-strong)]">
                          {entry.prepPlan.checklist.length} steps
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {[
                          prepSection("Start here", entry.prepPlan.firstMoves, "No immediate first moves detected."),
                          prepSection("Prep ahead", entry.prepPlan.prepTasks, "No ingredient prep detected."),
                          prepSection("Make ahead", entry.prepPlan.makeAheadTasks, "No make-ahead cues detected."),
                          prepSection("Open windows", entry.prepPlan.cookingWindows, "No longer waiting windows detected."),
                        ].map((section) => (
                          <div key={section.title} className="rounded-[20px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.82)] p-4">
                            <p className="text-sm font-semibold text-[color:var(--text)]">{section.title}</p>
                            {section.items.length > 0 ? (
                              <ul className="mt-2 space-y-2">
                                {section.items.map((item) => (
                                  <li key={item} className="rounded-[16px] bg-[rgba(250,248,242,0.92)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
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
              ) : null}
            </div>
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
    </div>
  );
}
