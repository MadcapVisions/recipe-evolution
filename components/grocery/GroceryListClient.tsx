"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/trackEvent";
import { Button } from "@/components/Button";

type RawIngredient = {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
  prep?: string | null;
};

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
  ownerId: string;
  versionId: string;
  existingListId: string | null;
  existingItems: GroceryItem[] | null;
  ingredients: RawIngredient[];
};

const PREP_TERMS = ["chopped", "diced", "minced", "sliced", "crushed", "grated", "peeled"];

const normalizeIngredient = (ingredient: RawIngredient) => {
  const originalName = (ingredient.name ?? "").trim();
  let normalized = originalName.toLowerCase();
  let prep = ingredient.prep ?? null;

  PREP_TERMS.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    if (regex.test(normalized) && !prep) {
      prep = term;
    }
    normalized = normalized.replace(regex, " ");
  });

  normalized = normalized.replace(/\s+/g, " ").trim();

  return {
    normalized_name: normalized || originalName.toLowerCase(),
    display_name: normalized || originalName,
    quantity: typeof ingredient.quantity === "number" ? ingredient.quantity : null,
    unit: ingredient.unit?.trim()?.toLowerCase() || null,
    prep,
  };
};

const generateItems = (ingredients: RawIngredient[]): GroceryItem[] => {
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
  const quantityPart = item.quantity != null ? String(item.quantity) : "";
  const unitPart = item.unit ?? "";
  const prepPart = item.prep ? ` (${item.prep})` : "";
  return `[${item.checked ? "x" : " "}] ${item.name}${prepPart} ${quantityPart} ${unitPart}`.replace(/\s+/g, " ").trim();
};

export function GroceryListClient({
  ownerId,
  versionId,
  existingListId,
  existingItems,
  ingredients,
}: GroceryListClientProps) {
  const [listId, setListId] = useState<string | null>(existingListId);
  const [items, setItems] = useState<GroceryItem[]>(existingItems ?? []);
  const [error, setError] = useState<string | null>(null);
  const [modalText, setModalText] = useState<string | null>(null);

  useEffect(() => {
    if (existingListId || existingItems) {
      return;
    }

    const createInitial = async () => {
      const generated = generateItems(ingredients);

      const { data, error: insertError } = await supabase
        .from("grocery_lists")
        .insert({
          owner_id: ownerId,
          version_id: versionId,
          items_json: generated,
        })
        .select("id, items_json")
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Unable to create grocery list.");
        return;
      }

      setListId(data.id);
      setItems((data.items_json as GroceryItem[]) ?? generated);
      await trackEvent("grocery_generated", {
        versionId,
        itemCount: ((data.items_json as GroceryItem[]) ?? generated).length,
      });
    };

    createInitial();
  }, [existingItems, existingListId, ingredients, ownerId, versionId]);

  const listText = useMemo(() => items.map(itemToText).join("\n"), [items]);

  const persistItems = async (nextItems: GroceryItem[]) => {
    if (!listId) {
      return;
    }

    const { error: updateError } = await supabase
      .from("grocery_lists")
      .update({ items_json: nextItems })
      .eq("id", listId);

    if (updateError) {
      setError(updateError.message);
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
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Grocery List",
          text: listText,
        });
        return;
      } catch {
        // Ignore share cancellation.
      }
    }

    setModalText(listText);
  };

  return (
    <div className="space-y-4">
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
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Button
              onClick={() => toggleItem(item.id)}
              variant="secondary"
              className={`flex min-h-14 w-full items-center justify-between text-left ${
                item.checked ? "bg-green-50" : "bg-white"
              }`}
            >
              <span className="text-base">
                {item.name}
                {item.prep ? ` (${item.prep})` : ""}
                {item.quantity != null ? ` ${item.quantity}` : ""}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
              <span className="text-sm">{item.checked ? "Done" : "Tap"}</span>
            </Button>
          </li>
        ))}
      </ul>

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
