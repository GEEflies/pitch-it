import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

/** Horná lišta obrazoviek z dizajnu: logo vľavo, voliteľný obsah vpravo. */
export function PiTopbar({ children, href = "/app" }: { children?: ReactNode; href?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-7 py-3.5">
      <Wordmark href={href} />
      {children}
    </div>
  );
}

/** Pozadie obrazoviek z dizajnu: fialová a limetková žiara nad základnou farbou. */
export const PI_BACKGROUND =
  "radial-gradient(900px 600px at 90% 0,var(--glow-violet),transparent 60%),radial-gradient(700px 500px at 0 20%,var(--glow-lime),transparent 60%),var(--color-ink)";
