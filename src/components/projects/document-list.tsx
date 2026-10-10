"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Spinner } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";

export type DocumentListItem = {
  id: string;
  fileName: string;
  fileType: "pdf" | "pptx";
  status: "uploaded" | "extracting" | "analyzing" | "ready" | "failed";
  slideCount: number | null;
  errorCode: string | null;
  summary: string | null;
  createdLabel: string;
};

const ERROR_TEXT: Record<string, string> = {
  analysis_not_configured: "Slidy sú prečítané. AI analýza nie je nakonfigurovaná, fakty doplň ručne.",
  analysis_failed: "Slidy sú prečítané, ale AI analýza zlyhala. Skús ju spustiť znova.",
  analysis_limit: "Slidy sú prečítané. Limit AI analýz je na tento mesiac vyčerpaný.",
  integrity: "Súbor sa nenahral celý. Nahraj ho znova.",
  type_mismatch: "Obsah súboru nie je PDF ani PPTX.",
};

function statusText(item: DocumentListItem): { text: string; tone: string } {
  switch (item.status) {
    case "uploaded":
      return { text: "Čaká na kontrolu súboru", tone: "text-mute" };
    case "extracting":
      return { text: "Čítam slidy", tone: "text-signal-soft" };
    case "analyzing":
      return { text: "AI analyzuje podklad", tone: "text-signal-soft" };
    case "failed":
      return { text: ERROR_TEXT[item.errorCode ?? ""] ?? "Súbor sa nepodarilo spracovať.", tone: "text-coral" };
    case "ready":
      return item.errorCode
        ? { text: ERROR_TEXT[item.errorCode] ?? "Spracované bez AI analýzy.", tone: "text-marker" }
        : { text: `Spracované, ${item.slideCount ?? 0} slidov`, tone: "text-mint" };
  }
}

/** Kým sa niečo spracúva, obnovuje stránku každé 4 sekundy. */
function useProcessingRefresh(active: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [active, router]);
}

export function DocumentList({ items, canEdit }: { items: DocumentListItem[]; canEdit: boolean }) {
  const processing = items.some((item) => item.status === "analyzing" || item.status === "extracting");
  useProcessingRefresh(processing);
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (items.length === 0) return null;

  const reanalyze = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      const response = await fetch(`/api/documents/${id}`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.show(body?.error?.message ?? "Analýzu sa nepodarilo spustiť.", "error");
      } else {
        toast.show("Analýza beží znova.", "info");
      }
      setBusyId(null);
      router.refresh();
    });
  };

  const remove = async (id: string) => {
    const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { status: "error" as const, message: body?.error?.message ?? "Podklad sa nepodarilo zmazať." };
    }
    router.refresh();
    return { status: "success" as const, message: "Podklad je zmazaný." };
  };

  return (
    <ul className="mt-6 divide-y divide-line/70 border-y border-line/70">
      {items.map((item) => {
        const status = statusText(item);
        const working = item.status === "analyzing" || item.status === "extracting";
        return (
          <li key={item.id} className="py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium text-paper" title={item.fileName}>
                  {item.fileName}
                </p>
                <p className={`mt-1 flex items-center gap-2 text-sm ${status.tone}`} role={working ? "status" : undefined}>
                  {working ? <Spinner className="size-3.5" /> : null}
                  {status.text}
                </p>
                <p className="mt-1 text-[13px] text-faint">
                  {item.fileType.toUpperCase()}, nahrané {item.createdLabel}
                </p>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 gap-1">
                  {item.status === "ready" && item.errorCode ? (
                    <button
                      type="button"
                      className={buttonClasses({ variant: "ghost" })}
                      onClick={() => reanalyze(item.id)}
                      disabled={pending && busyId === item.id}
                    >
                      Analyzovať znova
                    </button>
                  ) : null}
                  <ConfirmAction
                    trigger="Zmazať"
                    title="Zmazať podklad?"
                    description="Zmaže sa súbor, prečítané slidy a neskontrolované návrhy faktov z neho. Už potvrdené fakty ostanú."
                    confirmLabel="Zmazať"
                    pendingLabel="Mažem…"
                    action={() => remove(item.id)}
                  />
                </div>
              ) : null}
            </div>
            {item.summary ? <p className="mt-3 max-w-[48rem] text-[14.5px] leading-relaxed text-mute">{item.summary}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
