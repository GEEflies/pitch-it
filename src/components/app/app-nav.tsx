"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { APP_NAV, PREVIEW_NAV, type NavItem } from "@/components/app/nav-items";
import { Wordmark } from "@/components/wordmark";

function NavLinks({ onNavigate, items }: { onNavigate?: () => void; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.match(pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] transition-colors duration-150 ${
                active ? "bg-panel text-paper" : "text-mute hover:bg-panel/60 hover:text-paper"
              }`}
            >
              {active ? (
                <span aria-hidden="true" className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-signal" />
              ) : null}
              <svg viewBox="0 0 20 20" aria-hidden="true" className={`size-5 shrink-0 ${active ? "text-signal-soft" : ""}`}>
                <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Bočný panel na desktope, horná lišta s výsuvným menu na mobile. */
export function AppNav({ account, variant = "app" }: { account: ReactNode; variant?: "app" | "preview" }) {
  const items = variant === "preview" ? PREVIEW_NAV : APP_NAV;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Po navigácii menu zavrieme (porovnanie počas renderu, nie v efekte).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/70 bg-ink-2 px-5 py-6 lg:flex">
        <Wordmark className="px-1" />
        <nav aria-label="Aplikácia" className="mt-10 flex-1">
          <NavLinks items={items} />
        </nav>
        <div className="border-t border-line/70 pt-4">{account}</div>
      </aside>

      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-line/70 bg-ink/95 px-4 lg:hidden">
        <Wordmark />
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Zavrieť menu" : "Otvoriť menu"}
          className="inline-flex size-11 items-center justify-center rounded-[10px] border border-line-strong text-paper"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
            <path
              d={open ? "M5 5l10 10M15 5 5 15" : "M3.5 6h13M3.5 10h13M3.5 14h13"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <m.div
            id={panelId}
            key="app-mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-ink px-5 py-6 lg:hidden"
          >
            <nav aria-label="Aplikácia">
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="mt-8 border-t border-line/70 pt-4">{account}</div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
