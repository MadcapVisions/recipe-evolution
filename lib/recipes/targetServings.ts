"use client";

import { useEffect, useMemo, useState } from "react";

function storageKey(versionId: string) {
  return `target-servings:${versionId}`;
}

export function readStoredTargetServings(versionId: string, fallback: number) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(versionId));
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredTargetServings(versionId: string, value: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(versionId), String(Math.max(1, Math.round(value))));
  } catch {
    // ignore storage errors
  }
}

export function useTargetServings(versionId: string, baseServings: number | null) {
  const fallback = useMemo(() => (typeof baseServings === "number" && baseServings > 0 ? baseServings : 1), [baseServings]);
  const [targetServings, setTargetServings] = useState(fallback);

  useEffect(() => {
    setTargetServings(readStoredTargetServings(versionId, fallback));
  }, [fallback, versionId]);

  useEffect(() => {
    writeStoredTargetServings(versionId, targetServings);
  }, [targetServings, versionId]);

  return {
    targetServings,
    setTargetServings: (value: number) => setTargetServings(Math.max(1, Math.round(value))),
    canScale: typeof baseServings === "number" && baseServings > 0,
    baseServings: typeof baseServings === "number" && baseServings > 0 ? baseServings : null,
  };
}
