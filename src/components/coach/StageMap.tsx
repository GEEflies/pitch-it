import type { Metrics, Side } from "@/lib/coach/pose/metrics";

const SIDES: { id: Side; label: string }[] = [
  { id: "left", label: "Vľavo" },
  { id: "center", label: "Stred" },
  { id: "right", label: "Vpravo" },
];

/** Pohľad zhora na pódium: kde stojíš a kam sa pozeráš. */
export default function StageMap({ m }: { m: Metrics | null }) {
  const x = m ? Math.min(1, Math.max(0, m.stageX)) : 0.5;
  return (
    <div className="w-full max-w-md rounded-2xl bg-black/70 p-3 backdrop-blur-md">
      <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-[0.25em] text-faint">
        <span>Priestor</span>
        <span>
          {m ? (m.walking ? "moving" : "standing") : "—"} · looking{" "}
          {m ? SIDES.find((s) => s.id === m.gaze)!.label.toLowerCase() : "—"}
        </span>
      </div>
      <div className="relative h-12">
        <div className="absolute inset-0 grid grid-cols-3 gap-1">
          {SIDES.map((s) => (
            <div
              key={s.id}
              className="flex items-end justify-center rounded-md pb-1 text-[10px] uppercase tracking-widest transition-colors"
              style={{
                background: m?.stage === s.id ? "rgba(230,43,30,0.22)" : "rgba(255,255,255,0.05)",
                color: m?.gaze === s.id ? "#fff" : "#7a7a86",
              }}
            >
              {m?.gaze === s.id ? "◉ " : ""}
              {s.label}
            </div>
          ))}
        </div>
        {m && (
          <div
            className="absolute top-1 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-signal shadow-[0_0_16px_#aaff00] transition-[left] duration-200"
            style={{ left: `${x * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
