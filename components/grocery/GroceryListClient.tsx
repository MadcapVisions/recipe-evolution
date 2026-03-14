"use client";

import { useEffect, useMemo, useState } from "react";
import { deriveIngredientDetails } from "@/lib/recipes/canonicalEnrichment";
import type { CanonicalIngredient } from "@/lib/recipes/canonicalRecipe";
import { buildGroceryPlan } from "@/lib/recipes/groceryPlanning";
import { formatGroceryItemDisplay, scaleGroceryItemsForServings } from "@/lib/recipes/servings";
import { useTargetServings } from "@/lib/recipes/targetServings";
import { downloadTextFile, shareOrFallback } from "@/lib/exportText";
import { trackEvent } from "@/lib/trackEvent";
import { Button } from "@/components/Button";
import { ServingsControl } from "@/components/ServingsControl";

type GroceryItem = {
  id: string;
  name: string;
  normalized_name: string;
  quantity: number | null;
  unit: string | null;
  prep: string | null;
  checked: boolean;
};

type GroceryListClientProps = {
  recipeId: string;
  versionId: string;
  baseServings: number | null;
  pantryStaples: string[];
  existingListId: string | null;
  existingItems: GroceryItem[] | null;
  ingredients: CanonicalIngredient[];
};

const normalizeIngredient = (ingredient: CanonicalIngredient) => {
  const originalName = ingredient.name.trim();
  const derived = deriveIngredientDetails(originalName);
  let normalized = originalName.toLowerCase();
  const prep = derived.prep;

  if (prep) {
    normalized = normalized.replace(new RegExp(`\\b${prep}\\b`, "gi"), " ");
  }

  normalized = normalized.replace(/\s+/g, " ").trim();

  return {
    normalized_name: normalized || originalName.toLowerCase(),
    display_name: normalized || originalName,
    quantity: derived.quantity,
    unit: derived.unit,
    prep,
  };
};

const generateItems = (ingredients: CanonicalIngredient[]): GroceryItem[] => {
  const aggregations = new Map<
    string,
    {
      name: string;
      normalized_name: string;
      quantity: number | null;
      unit: string | null;
      prep: string | null;
      canSum: boolean;
      occurrences: number;
    }
  >();

  ingredients.forEach((ingredient) => {
    const normalized = normalizeIngredient(ingredient);

    if (!normalized.normalized_name) {
      return;
    }

    const canSum = normalized.quantity != null;
    const unitKey = normalized.unit ?? "";
    const baseKey = `${normalized.normalized_name}|${unitKey}`;

    if (!canSum) {
      const uniqueKey = `${baseKey}|nosum|${crypto.randomUUID()}`;
      aggregations.set(uniqueKey, {
        name: normalized.display_name,
        normalized_name: normalized.normalized_name,
        quantity: null,
        unit: normalized.unit,
        prep: normalized.prep,
        canSum: false,
        occurrences: 1,
      });
      return;
    }

    const existing = aggregations.get(baseKey);

    if (!existing) {
      aggregations.set(baseKey, {
        name: normalized.display_name,
        normalized_name: normalized.normalized_name,
        quantity: normalized.quantity,
        unit: normalized.unit,
        prep: normalized.prep,
        canSum: true,
        occurrences: 1,
      });
      return;
    }

    if (existing.canSum && existing.quantity != null && normalized.quantity != null) {
      existing.quantity += normalized.quantity;
      existing.occurrences += 1;
      return;
    }

    const uniqueKey = `${baseKey}|nosum|${crypto.randomUUID()}`;
    aggregations.set(uniqueKey, {
      name: normalized.display_name,
      normalized_name: normalized.normalized_name,
      quantity: normalized.quantity,
      unit: normalized.unit,
      prep: normalized.prep,
      canSum: false,
      occurrences: 1,
    });
  });

  return Array.from(aggregations.values()).map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    normalized_name: item.normalized_name,
    quantity: item.quantity,
    unit: item.unit,
    prep: item.prep,
    checked: false,
  }));
};

const itemToText = (item: GroceryItem) => {
  const formatted = formatGroceryItemDisplay(item);
  return `[${item.checked ? "x" : " "}] ${formatted.primary}`.trim();
};

export function GroceryListClient({
  recipeId,
  versionId,
  baseServings,
  pantryStaples,
  existingListId,
  existingItems,
  ingredients,
}: GroceryListClientProps) {
  const { targetServings, setTargetServings, canScale, baseServings: effectiveBaseServings } = useTargetServings(versionId, baseServings);
  const [listId, setListId] = useState<string | null>(existingListId);
  const [items, setItems] = useState<GroceryItem[]>(existingItems ?? []);
  const [hidePantryItems, setHidePantryItems] = useState(true);
  const [savingPantryItem, setSavingPantryItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalText, setModalText] = useState<string | null>(null);

  useEffect(() => {
    if (existingListId || existingItems) {
      return;
    }

    const createInitial = async () => {
      const generated = generateItems(ingredients);

      const response = await fetch(`/api/recipes/${recipeId}/versions/${versionId}/grocery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: generated }),
      });
      const payload = (await response.json()) as {
        message?: string;
        listId?: string;
        items?: GroceryItem[];
      };

      if (!response.ok || !payload.listId) {
        setError(payload.message ?? "Unable to create grocery list.");
        return;
      }

      setListId(payload.listId);
      setItems(payload.items ?? generated);
      await trackEvent("grocery_generated", {
        versionId,
        itemCount: (payload.items ?? generated).length,
      });
    };

    createInitial();
  }, [existingItems, existingListId, ingredients, recipeId, versionId]);

  const displayItems = useMemo(
    () => (canScale && effectiveBaseServings ? scaleGroceryItemsForServings(items, effectiveBaseServings, targetServings) : items),
    [effectiveBaseServings, canScale, items, targetServings]
  );
  const groceryPlan = useMemo(() => buildGroceryPlan(displayItems, pantryStaples), [displayItems, pantryStaples]);
  const listText = useMemo(() => {
    const sections = groceryPlan.groupedItems.map((group) => [group.aisle, ...group.items.map(itemToText)].join("\n"));
    if (groceryPlan.flexibleItems.length > 0) {
      sections.push(["Flexible items", ...groceryPlan.flexibleItems.map(itemToText)].join("\n"));
    }
    if (!hidePantryItems && groceryPlan.pantryItems.length > 0) {
      sections.push(["Pantry / already have", ...groceryPlan.pantryItems.map(itemToText)].join("\n"));
    }
    return sections.join("\n\n");
  }, [groceryPlan.flexibleItems, groceryPlan.groupedItems, groceryPlan.pantryItems, hidePantryItems]);

  const persistItems = async (nextItems: GroceryItem[]) => {
    if (!listId) {
      return;
    }

    const response = await fetch(`/api/recipes/${recipeId}/versions/${versionId}/grocery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: nextItems }),
    });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(payload.message ?? "Could not update grocery list.");
    }
  };

  const toggleItem = async (itemId: string) => {
    const nextItems = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            checked: !item.checked,
          }
        : item
    );

    setItems(nextItems);
    await persistItems(nextItems);
  };

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(listText);
    } catch {
      setModalText(listText);
    }
  };

  const shareList = async () => {
    await shareOrFallback("Grocery List", listText, () => setModalText(listText));
  };

  const exportList = () => {
    downloadTextFile(`grocery-list-${versionId}.txt`, listText);
  };

  const printList = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const togglePantryStaple = async (itemName: string, stocked: boolean) => {
    setSavingPantryItem(itemName);
    setError(null);
    try {
      const response = await fetch("/api/user/preferences/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: itemName, stocked }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? "Could not update pantry settings.");
      }
    } finally {
      setSavingPantryItem(null);
    }
  };

  return (
    <div className="space-y-4">
      <ServingsControl label="Shop for" baseServings={effectiveBaseServings} targetServings={targetServings} onChange={setTargetServings} />

      <div className="rounded-lg border bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Shopping plan</p>
            <p className="text-sm text-slate-600">
              {groceryPlan.groupedItems.length} aisle section{groceryPlan.groupedItems.length === 1 ? "" : "s"}
              {groceryPlan.pantryItems.length > 0 ? `, ${groceryPlan.pantryItems.length} pantry staple${groceryPlan.pantryItems.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={hidePantryItems} onChange={(event) => setHidePantryItems(event.target.checked)} />
            Hide pantry staples
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={copyList}
          variant="secondary"
          className="min-h-12"
        >
          Copy List
        </Button>
        <Button
          onClick={shareList}
          className="min-h-12"
        >
          Share
        </Button>
        <Button onClick={exportList} variant="secondary" className="min-h-12">
          Export TXT
        </Button>
        <Button onClick={printList} variant="secondary" className="min-h-12">
          Print
        </Button>
      </div>

      <div className="space-y-4">
        {groceryPlan.groupedItems.map((group) => (
          <section key={group.aisle} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.aisle}</h2>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <li key={item.id}>
                  <GroceryRow
                    item={item}
                    actionLabel={item.checked ? "Done" : "Tap"}
                    savingPantryItem={savingPantryItem}
                    onToggleItem={toggleItem}
                    onMarkStocked={togglePantryStaple}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {groceryPlan.flexibleItems.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Flexible items</h2>
            <ul className="space-y-2">
              {groceryPlan.flexibleItems.map((item) => (
                <li key={item.id}>
                  <PantryRow item={item} label="Check recipe" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!hidePantryItems && groceryPlan.pantryItems.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pantry / already have</h2>
            <ul className="space-y-2">
              {groceryPlan.pantryItems.map((item) => (
                <li key={item.id}>
                  <PantryRow item={item} label="Pantry" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {modalText ? (
        <div className="rounded-md border bg-white p-4">
          <p className="mb-2 text-sm font-medium">Manual copy</p>
          <textarea value={modalText} readOnly className="min-h-40 w-full" />
          <Button
            onClick={() => setModalText(null)}
            variant="secondary"
            className="mt-3 min-h-11"
          >
            Close
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function GroceryRow({
  item,
  actionLabel,
  savingPantryItem,
  onToggleItem,
  onMarkStocked,
}: {
  item: GroceryItem;
  actionLabel: string;
  savingPantryItem: string | null;
  onToggleItem: (itemId: string) => Promise<void>;
  onMarkStocked: (itemName: string, stocked: boolean) => Promise<void>;
}) {
  const formatted = formatGroceryItemDisplay(item);

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => void onToggleItem(item.id)}
        variant="secondary"
        className={`flex min-h-14 flex-1 items-center justify-between text-left ${item.checked ? "bg-green-50" : "bg-white"}`}
      >
        <span className="text-base">
          <span className="block">{formatted.primary}</span>
          {formatted.secondary ? <span className="mt-1 block text-sm text-slate-500">{formatted.secondary}</span> : null}
        </span>
        <span className="text-sm">{actionLabel}</span>
      </Button>
      <Button
        onClick={() => void onMarkStocked(item.name, true)}
        variant="secondary"
        className="min-h-14 whitespace-nowrap px-4"
        disabled={savingPantryItem === item.name}
      >
        Stocked
      </Button>
    </div>
  );
}

function PantryRow({ item, label }: { item: GroceryItem; label: string }) {
  const formatted = formatGroceryItemDisplay(item);

  return (
    <div className="flex min-h-14 w-full items-center justify-between rounded-lg border bg-white px-4 py-3 text-left opacity-80">
      <span className="text-base">
        <span className="block">{formatted.primary}</span>
      </span>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}
