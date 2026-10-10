import type { ReactNode } from "react";

type Tone = "info" | "attention" | "error" | "success";

const tones: Record<Tone, { box: string; icon: string; path: string }> = {
  info: {
    box: "border-line-strong bg-panel/70",
    icon: "text-signal-soft",
    path: "M8 7.2v4M8 4.8h.01",
  },
  attention: {
    box: "border-marker/40 bg-marker/[0.07]",
    icon: "text-marker",
    path: "M8 4.5v4.2M8 11.2h.01",
  },
  error: {
    box: "border-coral/45 bg-coral/[0.07]",
    icon: "text-coral",
    path: "M5.5 5.5l5 5M10.5 5.5l-5 5",
  },
  success: {
    box: "border-mint/40 bg-mint/[0.06]",
    icon: "text-mint",
    path: "M4.5 8.3l2.3 2.3 4.7-5",
  },
};

/** Oznam v toku stránky. Pre chyby a stavy, ktoré treba vidieť, nie pre dekoráciu. */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className = "",
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const meta = tones[tone];
  return (
    <div
      role={role ?? (tone === "error" ? "alert" : undefined)}
      className={`flex gap-3 rounded-[12px] border p-4 ${meta.box} ${className}`}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${meta.icon}`}>
        <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d={meta.path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div className="min-w-0 flex-1 text-[14.5px] leading-relaxed [overflow-wrap:anywhere] text-paper/90">
        {title ? <p className="font-medium text-paper">{title}</p> : null}
        {children ? <div className={title ? "mt-1 text-mute" : ""}>{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
