import type { ReactNode } from "react";
import { isAuthConfigured } from "@/config/env";
import { Notice } from "@/components/ui/notice";

/** Spoločná kostra auth stránok: nadpis, stav konfigurácie a formulár. */
export function AuthPage({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const configured = isAuthConfigured();
  return (
    <div className="max-w-[28rem]">
      <h1 className="type-display text-[clamp(2.2rem,1.7rem+1.8vw,3rem)]">{title}</h1>
      {description ? <p className="mt-4 leading-relaxed text-mute">{description}</p> : null}
      {!configured ? (
        <Notice tone="attention" className="mt-8" title="Účty momentálne nefungujú">
          {process.env.NODE_ENV !== "production"
            ? "Vývojárska poznámka: nastav NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY v .env.local a reštartuj server. Postup je v README."
            : "Skús to prosím neskôr."}
        </Notice>
      ) : null}
      <div className="mt-8">{children}</div>
      {footer ? <div className="mt-10 border-t border-line/70 pt-6 text-[15px] text-mute">{footer}</div> : null}
    </div>
  );
}

export function authAvailable(): boolean {
  return isAuthConfigured();
}
