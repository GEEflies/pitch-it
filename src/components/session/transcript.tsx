"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format";
import type { LiveTurn } from "@/lib/session/live-state";

/** Zápis zo stretnutia: investor pätkovým písmom, founder bezpätkovým. */
export function Transcript({ turns, delivery }: { turns: LiveTurn[]; delivery: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    const element = scroller.current;
    if (element && pinned) element.scrollTop = element.scrollHeight;
  }, [turns, pinned]);

  const visible = turns.filter((turn) => turn.text.trim() || turn.final);

  return (
    <div
      ref={scroller}
      onScroll={(event) => {
        const element = event.currentTarget;
        setPinned(element.scrollHeight - element.scrollTop - element.clientHeight < 80);
      }}
      className="h-full overflow-y-auto overscroll-contain pr-2"
      tabIndex={0}
      aria-label="Prepis rozhovoru"
    >
      {visible.length === 0 ? (
        <p className="text-[14.5px] text-faint">
          {delivery ? "Prepis tvojho prednesu sa zobrazí tu." : "Prepis sa zobrazí tu, ako rozhovor pobeží."}
        </p>
      ) : (
        <ol className="space-y-5">
          {visible.map((turn) => {
            const investor = turn.speaker === "investor";
            const text = turn.text.trim();
            return (
              <li key={turn.seq}>
                <p className="flex items-baseline gap-2 text-[12.5px] text-faint">
                  <span className={investor ? "text-signal-soft" : "text-paper/70"}>{investor ? "Investor" : "Ty"}</span>
                  {turn.startedMs !== null ? <span className="tabular-nums">{formatClock(turn.startedMs / 1000)}</span> : null}
                  {turn.interrupted ? <span className="text-marker">prerušené</span> : null}
                  {!turn.final ? <span>…</span> : null}
                </p>
                <p
                  className={`mt-1 leading-relaxed ${
                    investor ? "type-investor text-[1.06rem] text-paper" : "text-[15px] text-paper/85"
                  } ${!turn.final ? "opacity-70" : ""}`}
                >
                  {text || (turn.failed ? <span className="text-faint">(odpoveď sa nepodarilo prepísať)</span> : <span className="text-faint">(bez slov)</span>)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
