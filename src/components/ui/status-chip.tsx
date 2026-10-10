export type Status = "strong" | "refine" | "missing";

const statusMeta: Record<Status, { label: string; className: string; icon: string }> = {
  strong: {
    label: "Obstála",
    className: "border-mint/40 text-mint",
    icon: "M3.5 8.5l3 3 6-7",
  },
  refine: {
    label: "Spresniť",
    className: "border-marker/45 text-marker",
    icon: "M3.5 8h9",
  },
  missing: {
    label: "Chýba",
    className: "border-coral/45 text-coral",
    icon: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  },
};

/** Stav odpovede: farba + ikona + text, nikdy iba farba. */
export function StatusChip({ status }: { status: Status }) {
  const meta = statusMeta[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-medium whitespace-nowrap ${meta.className}`}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
        <path
          d={meta.icon}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {meta.label}
    </span>
  );
}
