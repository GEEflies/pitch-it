"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  projekty: "Projekty",
  novy: "Nový",
  podklady: "Podklady",
  trening: "Tréning",
  cvicenia: "Cvičenia",
  historia: "Reporty",
  porovnanie: "Porovnanie",
  nastavenia: "Nastavenia",
  progres: "Progres",
};

/** Názov detailu podľa rodičovskej sekcie (ID v URL nemá ľudský názov). */
const DETAIL_LABELS: Record<string, string> = {
  projekty: "Projekt",
  trening: "Rozbor",
  cvicenia: "Cvičenie",
};

/** Sekcie bez vlastnej stránky: odkazujú na najbližšiu existujúcu. */
const SECTION_HREF: Record<string, string> = {
  "/app/trening": "/app/historia",
};

export type Crumb = { href: string; label: string };

export function crumbsFor(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "app") return [];
  const crumbs: Crumb[] = [{ href: "/app", label: "Prehľad" }];
  let href = "/app";
  segments.slice(1).forEach((segment, index, rest) => {
    href += `/${segment}`;
    const label = LABELS[segment] ?? DETAIL_LABELS[rest[index - 1] ?? ""] ?? "Detail";
    crumbs.push({ href: SECTION_HREF[href] ?? href, label });
  });
  return crumbs;
}

export function Breadcrumbs() {
  const crumbs = crumbsFor(usePathname());
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Omrvinky" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <li key={crumb.href + index} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? (
                <span aria-hidden="true" className="text-line-strong">
                  /
                </span>
              ) : null}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-paper">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="truncate text-mute transition-colors hover:text-paper">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
