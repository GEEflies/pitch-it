"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

export function TypingDots({
  visible,
  className = "",
}: {
  visible: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <m.span
          className={`inline-flex items-center gap-1 rounded-full bg-panel-2 px-3 py-2 ${className}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <span className="typing-dot size-1.5 rounded-full bg-mute" />
          <span className="typing-dot size-1.5 rounded-full bg-mute" />
          <span className="typing-dot size-1.5 rounded-full bg-mute" />
        </m.span>
      ) : null}
    </AnimatePresence>
  );
}
