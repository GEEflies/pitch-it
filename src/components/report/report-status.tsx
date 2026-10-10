"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";

/** Kým sa report pripravuje, každé 3 s zistí stav a po dokončení obnoví stránku. */
export function ReportStatusPoller({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/report`, { cache: "no-store" });
        if (response.ok) {
          const { status } = (await response.json()) as { status: string | null };
          if (status && status !== "pending" && status !== "generating") {
            router.refresh();
            return;
          }
        }
      } catch {
        // Sieť: skúsime znova pri ďalšom kroku.
      }
      if (!stopped) setTimeout(poll, 3_000);
    };
    const timer = setTimeout(poll, 3_000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [sessionId, router]);

  return (
    <p className="flex items-center gap-2 text-mute" role="status">
      <Spinner />
      AI pripravuje rozbor obsahu. Zvyčajne to trvá do minúty, merania nižšie sú už hotové.
    </p>
  );
}

export function RetryReportButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={buttonClasses()}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const response = await fetch(`/api/sessions/${sessionId}/report`, { method: "POST" });
            if (!response.ok) {
              const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
              setError(body?.error?.message ?? "Rozbor sa nepodarilo spustiť.");
              return;
            }
            toast.show("Rozbor sa pripravuje znova.", "info");
            router.refresh();
          })
        }
      >
        {pending ? <Spinner /> : null}
        Pripraviť rozbor znova
      </button>
      {error ? <p className="mt-2 text-[14px] text-coral">{error}</p> : null}
    </div>
  );
}
