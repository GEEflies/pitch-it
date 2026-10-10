"use client";

import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";
import type { HintState } from "@/lib/session/controller";

export function HintPanel({ hint, onRequest, disabled }: { hint: HintState; onRequest: () => void; disabled: boolean }) {
  return (
    <section aria-labelledby="hint-title" className="rounded-[14px] border border-line bg-panel/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="hint-title" className="text-[15px] font-semibold text-paper">
          Nápoveda
        </h2>
        <button
          type="button"
          onClick={onRequest}
          disabled={disabled || hint.status === "loading"}
          className={buttonClasses({ variant: "secondary", className: "h-9 px-3 text-sm" })}
        >
          {hint.status === "loading" ? <Spinner className="size-3.5" /> : null}
          {hint.status === "ready" ? "Nová nápoveda" : "Ako na túto otázku"}
        </button>
      </div>
      <div aria-live="polite">
        {hint.status === "idle" ? (
          <p className="mt-2 text-[14px] leading-relaxed text-faint">
            Ukáže, na čo otázka mieri a ktoré tvoje údaje sa hodia. Odpoveď za teba nenapíše.
          </p>
        ) : null}
        {hint.status === "error" ? <p className="mt-2 text-[14px] text-coral">{hint.message}</p> : null}
        {hint.status === "ready" ? (
          <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed">
            <p className="text-paper">{hint.hint.approach}</p>
            <ol className="list-decimal space-y-1 pl-5 text-paper/85">
              {hint.hint.structure.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {hint.hint.facts_to_use.length > 0 ? (
              <div>
                <p className="text-[13px] text-faint">Tvoje údaje, ktoré sa hodia</p>
                <ul className="mt-1 space-y-1 text-paper/85">
                  {hint.hint.facts_to_use.map((fact) => (
                    <li key={fact} className="flex gap-2">
                      <span aria-hidden="true" className="mt-[0.7em] h-px w-3 shrink-0 bg-mint" />
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hint.hint.missing_data ? <p className="text-marker">Chýba ti: {hint.hint.missing_data}</p> : null}
            <p className="text-mute">Vyhni sa: {hint.hint.avoid}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
