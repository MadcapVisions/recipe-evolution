export type ResolutionMethod =
  | "exact_alias"
  | "normalized_alias"
  | "fuzzy_alias"
  | "family_inference"
  | "semantic_match"
  | "unresolved";

export type ResolvedIngredient = {
  raw_phrase: string;
  core_phrase: string | null;
  display_label: string | null;
  canonical_id: string | null;
  canonical_key: string | null;
  family_id: string | null;
  family_key: string | null;
  aliases_matched: string[];
  confidence: number;
  resolution_method: ResolutionMethod;
};

export type ResolvedIngredientIntent = {
  raw_phrase: string;
  label: string;
  canonical_key: string | null;
  canonical_id: string | null;
  family_key: string | null;
  confidence: number;
  resolution_method: ResolutionMethod;
};

export type IngredientCatalogEntry = {
  canonical_id: string;
  canonical_key: string;
  display_label: string;
  family_id: string | null;
  family_key: string | null;
  aliases: string[];
  related_terms?: string[];
  blockers?: string[];
};

export type IngredientMatchPolicy =
  | "strict_canonical"
  | "canonical_with_family_fallback"
  | "soft_preference"
  | "planning";
