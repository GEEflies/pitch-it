import type { ReactNode } from "react";
import { isAuthConfigured } from "@/config/env";
import { Notice } from "@/components/ui/notice";

/** Obsah auth panelu: nadpis v strede, stav konfigurácie, formulár a pätička. */
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
    <div>
      <h1 className="type-heading text-center text-[36px] leading-[1.1]">{title}</h1>
      {description ? <p className="mt-2.5 text-center text-base text-mute">{description}</p> : null}
      {!configured ? (
        <Notice tone="attention" className="mt-6" title="Účty momentálne nefungujú">
          {process.env.NODE_ENV !== "production"
            ? "Vývojárska poznámka: nastav AUTH_SECRET v .env.local a reštartuj server. Postup je v README."
            : "Skús to prosím neskôr."}
        </Notice>
      ) : null}
      <div className="mt-6">{children}</div>
      {footer ? <p className="mt-[26px] text-center text-sm text-mute">{footer}</p> : null}
    </div>
  );
}

export function authAvailable(): boolean {
  return isAuthConfigured();
}
