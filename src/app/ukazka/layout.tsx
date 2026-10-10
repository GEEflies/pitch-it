import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ToastProvider } from "@/components/ui/toast";
import { isPreviewEnabled } from "@/lib/preview/links";

export const instant = false;

export const metadata: Metadata = {
  title: { default: "Ukážka aplikácie", template: "%s | Ukážka | Pitch It" },
  robots: { index: false, follow: false },
};

/** Vývojová ukážka obrazoviek s ukážkovými dátami. V produkcii vráti 404. */
export default function PreviewLayout({ children }: { children: ReactNode }) {
  if (!isPreviewEnabled()) notFound();
  return (
    <ToastProvider>
      <div className="sticky top-0 z-[60] border-b border-marker/40 bg-[#2a2210] px-4 py-2 text-center text-[13px] text-marker">
        Ukážkový režim (iba vývoj): vymyslený startup a ukážkové dáta. Nič sa neukladá a AI tu nahrádza pripravený scenár.
      </div>
      {children}
    </ToastProvider>
  );
}
