"use client";

function buildServingOptions(baseServings: number, targetServings: number) {
  const candidates = new Set<number>([
    1,
    Math.max(1, Math.round(baseServings / 2)),
    baseServings,
    Math.max(1, Math.round(baseServings * 2)),
    targetServings,
  ]);

  for (let value = 2; value <= 12; value += 1) {
    candidates.add(value);
  }

  return Array.from(candidates)
    .filter((value) => Number.isFinite(value) && value >= 1)
    .sort((left, right) => left - right);
}

export function ServingsControl({
  label = "Servings",
  baseServings,
  targetServings,
  onChange,
  className,
}: {
  label?: string;
  baseServings: number | null;
  targetServings: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  if (!baseServings) {
    return (
      <div className={className}>
        <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-600">
          Add servings to this version to unlock scaling.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <label className="flex min-w-0 flex-col gap-2 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-3 rounded-xl border bg-slate-50 px-3 py-3">
          <select
            value={targetServings}
            onChange={(event) => onChange(Number(event.target.value) || baseServings)}
            className="min-h-11 min-w-[7rem] rounded-md border bg-white px-3 text-[15px] text-slate-900"
          >
            {buildServingOptions(baseServings, targetServings).map((value) => (
              <option key={value} value={value}>
                {value} {value === 1 ? "serving" : "servings"}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">Base recipe serves {baseServings}.</span>
        </div>
      </label>
    </div>
  );
}
