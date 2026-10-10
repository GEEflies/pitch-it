"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";

type ActionResult = { status: "idle" | "error" | "success"; message?: string } | void;

/**
 * Tlačidlo s potvrdzovacím dialógom pre nevratné akcie (mazanie).
 * Používa natívny <dialog>: focus trap, Esc a prístupnosť zadarmo.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  action,
  tone = "danger",
  triggerClassName,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  action: () => Promise<ActionResult>;
  tone?: "danger" | "default";
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setError(null);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && result.status === "error") {
        setError(result.message ?? "Akcia zlyhala.");
        return;
      }
      if (result && result.status === "success" && result.message) toast.show(result.message);
      dialogRef.current?.close();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={triggerClassName ?? buttonClasses({ variant: "ghost", className: tone === "danger" ? "text-coral hover:text-coral" : "" })}
      >
        {trigger}
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[16px] border border-line-strong bg-panel p-0 text-paper backdrop:bg-ink/80"
      >
        <div className="p-6">
          <h2 className="type-heading text-[1.35rem]">{title}</h2>
          <div className="mt-3 leading-relaxed text-mute">{description}</div>
          {error ? (
            <p role="alert" className="mt-4 text-[14.5px] text-coral">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className={buttonClasses({ variant: "secondary" })}
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
            >
              Zrušiť
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className={buttonClasses({
                className: tone === "danger" ? "bg-coral text-on-signal shadow-none hover:bg-coral/90" : "",
              })}
            >
              {pending ? (
                <>
                  <Spinner />
                  {pendingLabel}
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
