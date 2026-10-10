"use client";

import { useId, useState } from "react";
import { faqItems } from "@/content/faq";

export function FaqList() {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);

  return (
    <div className="border-t border-line/70">
      {faqItems.map((item) => {
        const open = openId === item.id;
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;
        return (
          <div key={item.id} className="border-b border-line/70">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenId(open ? null : item.id)}
                className="group flex w-full items-center justify-between gap-6 py-5 text-left md:py-6"
              >
                <span
                  className={`text-[1.125rem] font-medium transition-colors duration-200 md:text-[1.25rem] ${
                    open ? "text-paper" : "text-paper/85 group-hover:text-paper"
                  }`}
                >
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className={`relative flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                    open
                      ? "border-signal-soft/70 bg-signal/15"
                      : "border-line-strong group-hover:border-signal-soft/50"
                  }`}
                >
                  <span className="absolute h-px w-3.5 bg-paper" />
                  <span
                    className={`absolute h-3.5 w-px bg-paper transition-transform duration-300 ease-out ${
                      open ? "scale-y-0" : "scale-y-100"
                    }`}
                  />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden" inert={!open}>
                <div className="max-w-[40rem] space-y-3 pr-12 pb-6 leading-relaxed text-mute">
                  {item.answer.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
