"use client";

import type { ReactNode } from "react";
import * as m from "motion/react-m";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "li";
};

/** Jemné odhalenie pri scrolle; spustí sa iba raz. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  as = "div",
}: RevealProps) {
  const Component = as === "li" ? m.li : m.div;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1], delay }}
    >
      {children}
    </Component>
  );
}
