"use client";

import * as m from "motion/react-m";

/** Linka, ktorá sa pri scrolle vykreslí zľava doprava (alebo zhora nadol). */
export function DrawnLine({
  className = "",
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  const horizontal = orientation === "horizontal";
  return (
    <m.span
      aria-hidden="true"
      className={`block ${horizontal ? "origin-left" : "origin-top"} ${className}`}
      initial={horizontal ? { scaleX: 0 } : { scaleY: 0 }}
      whileInView={horizontal ? { scaleX: 1 } : { scaleY: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    />
  );
}
