"use client";

import { useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "theme";
const OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "Systém" },
  { value: "light", label: "Svetlá" },
  { value: "dark", label: "Tmavá" },
];

/** Pred vykreslením nastaví data-theme z localStorage (bez bliknutia). */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();

function read(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Úložisko nemusí byť dostupné (súkromné okno); téma platí aspoň do obnovenia.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  return (
    <div role="radiogroup" aria-label="Téma" className="flex gap-1 rounded-full border border-line p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          onClick={() => apply(option.value)}
          className={`flex-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
            theme === option.value ? "bg-panel-2 text-paper" : "text-mute hover:text-paper"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
