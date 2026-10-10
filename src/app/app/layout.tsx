import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { siteConfig } from "@/config/site";

// Celá aplikácia je per-používateľ (relácia, URL, dáta): navigácie smú čakať na server.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Aplikácia", template: `%s | ${siteConfig.name}` },
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
