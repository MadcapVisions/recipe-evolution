export function UserMenu({
  label = "U",
}: {
  label?: string;
  email?: string | null;
}) {
  return (
    <a
      href="/settings"
      aria-label="Open settings"
      title="Settings"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(79,54,33,0.14)] bg-[rgba(255,252,246,0.82)] text-sm font-semibold text-[color:var(--text)] shadow-[0_8px_18px_rgba(76,50,24,0.06)] transition hover:bg-white"
    >
        {label}
    </a>
  );
}
