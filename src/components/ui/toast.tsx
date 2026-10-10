"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; tone: ToastTone; message: string };

type ToastApi = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastApi | null>(null);

const toneClass: Record<ToastTone, string> = {
  success: "border-mint/45",
  error: "border-coral/55",
  info: "border-line-strong",
};

const dotClass: Record<ToastTone, string> = {
  success: "bg-mint",
  error: "bg-coral",
  info: "bg-signal-soft",
};

/** Krátke potvrdenia akcií. Chyby, ktoré treba vyriešiť, patria do stránky (Notice), nie sem. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[150] flex flex-col items-center gap-2 px-4 md:right-6 md:left-auto md:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <m.div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22 }}
              className={`pointer-events-auto flex max-w-[26rem] items-start gap-3 rounded-[12px] border bg-panel-2 px-4 py-3 text-[14.5px] text-paper shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] ${toneClass[toast.tone]}`}
            >
              <span aria-hidden="true" className={`mt-[0.45em] size-2 shrink-0 rounded-full ${dotClass[toast.tone]}`} />
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="-mr-1 rounded-md px-1 text-mute hover:text-paper"
                aria-label="Zavrieť oznámenie"
              >
                ×
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast musí byť vo vnútri ToastProvider.");
  return api;
}
