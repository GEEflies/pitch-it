"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { APP_NAV, NEW_TRAINING_ICON, PREVIEW_NAV, SETTINGS_NAV, type NavItem } from "@/components/app/nav-items";
import { Wordmark } from "@/components/wordmark";

function NavIcon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={`size-[18px] shrink-0 ${className}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150 ${
                active ? "bg-panel-2 font-medium text-paper" : "text-mute hover:bg-panel hover:text-paper"
              }`}
            >
              <NavIcon d={item.icon} className={active ? "text-paper" : "text-faint"} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NewTrainingButton({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/app/trening/novy"
      onClick={onNavigate}
      className="flex h-9 items-center justify-center gap-2 rounded-md bg-signal px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-signal-hover"
    >
      <NavIcon d={NEW_TRAINING_ICON} />
      Nový tréning
    </Link>
  );
}

function SidebarBody({
  variant,
  onNavigate,
  footer,
}: {
  variant: "app" | "preview";
  onNavigate?: () => void;
  footer: ReactNode;
}) {
  const items = variant === "preview" ? PREVIEW_NAV : APP_NAV;
  return (
    <>
      {variant === "app" ? (
        <div className="mt-5">
          <NewTrainingButton onNavigate={onNavigate} />
        </div>
      ) : null}
      <nav aria-label="Aplikácia" className="mt-5 flex flex-1 flex-col">
        <p className="mb-1.5 px-2.5 text-xs font-medium tracking-wide text-faint uppercase">Pracovný priestor</p>
        <NavLinks items={items} onNavigate={onNavigate} />
        {variant === "app" ? (
          <div className="mt-auto pt-6">
            <NavLinks items={SETTINGS_NAV} onNavigate={onNavigate} />
          </div>
        ) : null}
      </nav>
      <div className="mt-4 border-t border-line pt-4">{footer}</div>
    </>
  );
}

/**
 * Bočný panel na desktope, horná lišta s výsuvným menu na mobile.
 * `footer` je serverový obsah (plán, účet), preto sa podáva zvonku.
 */
export function AppNav({ account, variant = "app" }: { account: ReactNode; variant?: "app" | "preview" }) {
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-ink-2 px-3 py-4 lg:flex">
        <Wordmark className="px-1.5" />
        <SidebarBody variant={variant} footer={account} />
      </aside>

      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-ink/95 px-4 backdrop-blur lg:hidden">
        <Wordmark />
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Zavrieť menu" : "Otvoriť menu"}
          className="inline-flex size-10 items-center justify-center rounded-md border border-line-strong text-paper"
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
            transition={{ duration: 0.18 }}
            className="fixed inset-x-0 top-14 bottom-0 z-40 flex flex-col overflow-y-auto bg-ink px-4 pb-6 lg:hidden"
          >
            <SidebarBody variant={variant} footer={account} onNavigate={() => setOpen(false)} />
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
