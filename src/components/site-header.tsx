"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { navLinks, type Cta } from "@/config/site";
import { buttonClasses } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export function SiteHeader({ cta }: { cta: Cta }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  // Mobilné menu: zamknutý scroll, Esc, focus trap, zatvorenie pri zväčšení okna.
  useEffect(() => {
    if (!open) return;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current || !toggleRef.current) return;

      const focusables = [
        toggleRef.current,
        ...panelRef.current.querySelectorAll<HTMLElement>("a, button"),
      ];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const desktop = window.matchMedia("(min-width: 768px)");
    const onBreakpoint = () => desktop.matches && close(false);

    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onBreakpoint);
    };
  }, [open, close]);

  const elevated = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color] duration-300 ${
        elevated
          ? "border-line/80 bg-ink/95"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Wordmark />

        <nav aria-label="Hlavná navigácia" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-[15px] text-mute transition-colors duration-200 hover:bg-panel/70 hover:text-paper"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/prihlasenie"
            className="hidden rounded-lg px-3 py-2 text-[15px] text-mute transition-colors hover:text-paper sm:inline-block"
          >
            Prihlásiť sa
          </Link>
          <Link
            href={cta.href}
            className={buttonClasses({
              size: "md",
              className: "h-10 px-4 text-sm max-[359px]:hidden",
            })}
          >
            {cta.label}
          </Link>

          <button
            ref={toggleRef}
            type="button"
            className="relative inline-flex size-11 items-center justify-center rounded-[10px] border border-line-strong text-paper transition-colors hover:bg-panel md:hidden"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Zavrieť menu" : "Otvoriť menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true" className="relative block h-3 w-5">
              <span
                className={`absolute left-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ease-out ${
                  open ? "top-[5px] rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 h-0.5 w-5 rounded-full bg-current transition-transform duration-300 ease-out ${
                  open ? "top-[5px] -rotate-45" : "top-[10px]"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <m.div
            ref={panelRef}
            id={panelId}
            key="mobile-nav"
            className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto border-t border-line bg-ink md:hidden"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
          >
            <nav aria-label="Mobilná navigácia" className="container-page py-8">
              <ul className="flex flex-col">
                {navLinks.map((link, index) => (
                  <m.li
                    key={link.href}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + index * 0.05, duration: 0.3 }}
                    className="border-b border-line/70"
                  >
                    <Link
                      href={link.href}
                      onClick={() => close(false)}
                      className="type-heading flex items-center justify-between py-4 text-[1.75rem] text-paper"
                    >
                      {link.label}
                    </Link>
                  </m.li>
                ))}
              </ul>
              <Link
                href={cta.href}
                onClick={() => close(false)}
                className={buttonClasses({ size: "lg", className: "mt-8 w-full" })}
              >
                {cta.label}
              </Link>
              <Link
                href="/prihlasenie"
                onClick={() => close(false)}
                className={buttonClasses({ variant: "secondary", size: "lg", className: "mt-3 w-full" })}
              >
                Prihlásiť sa
              </Link>
              <p className="mt-4 text-sm text-faint">{cta.note}</p>
            </nav>
          </m.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
