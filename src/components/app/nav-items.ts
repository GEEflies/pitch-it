export type NavItem = { href: string; label: string; icon: string; match: (path: string) => boolean };

/* Ikony: 20×20, ťah 1.6. */
export const APP_NAV: NavItem[] = [
  {
    href: "/app",
    label: "Prehľad",
    icon: "M3.5 10.5 10 4l6.5 6.5M5.5 9v7h3.5v-4h2v4h3.5V9",
    match: (path) => path === "/app",
  },
  {
    href: "/app/projekty",
    label: "Projekty",
    icon: "M3.5 6.5h13v9.5h-13zM7.5 6.5V4.5h5v2",
    match: (path) => path.startsWith("/app/projekty"),
  },
  {
    href: "/app/cvicenia",
    label: "Cvičenia",
    icon: "M4 15.5 8 11l3 3 5-6.5M12.5 7.5H16V11",
    match: (path) => path.startsWith("/app/cvicenia"),
  },
  {
    href: "/app/historia",
    label: "História",
    icon: "M10 5.5v4.5l3 2M3.8 10a6.2 6.2 0 1 0 1.9-4.5M3.5 3.8v2.7h2.7",
    match: (path) => path.startsWith("/app/historia") || /^\/app\/trening\/(?!novy)/.test(path),
  },
];

export const NEW_TRAINING_ICON = "M10 3.5a3 3 0 0 1 3 3v3a3 3 0 0 1-6 0v-3a3 3 0 0 1 3-3ZM5 9.5a5 5 0 0 0 10 0M10 14.5v2.5";

export const SETTINGS_NAV: NavItem[] = [
  {
    href: "/app/nastavenia",
    label: "Nastavenia",
    icon: "M10 7.3a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4ZM10 3v1.6M10 15.4V17M3 10h1.6M15.4 10H17M5 5l1.1 1.1M13.9 13.9 15 15M5 15l1.1-1.1M13.9 6.1 15 5",
    match: (path) => path.startsWith("/app/nastavenia"),
  },
];

const ALL_NAV = [...APP_NAV, ...SETTINGS_NAV];
const iconOf = (href: string) => href === "/app/trening/novy" ? NEW_TRAINING_ICON : (ALL_NAV.find((item) => item.href === href)?.icon ?? APP_NAV[0].icon);

/** Navigácia vývojovej ukážky (/ukazka). */
export const PREVIEW_NAV: NavItem[] = [
  { href: "/ukazka/vitaj", label: "Úvodný kvíz", icon: "M4 5.5h12M4 10h12M4 14.5h7", match: (path) => path.startsWith("/ukazka/vitaj") },
  { href: "/ukazka/prehlad", label: "Prehľad", icon: iconOf("/app"), match: (path) => path === "/ukazka/prehlad" },
  { href: "/ukazka/podklady", label: "Podklady a fakty", icon: iconOf("/app/projekty"), match: (path) => path.startsWith("/ukazka/podklady") },
  { href: "/ukazka/novy-trening", label: "Nový tréning", icon: iconOf("/app/trening/novy"), match: (path) => path.startsWith("/ukazka/novy-trening") },
  { href: "/ukazka/report", label: "Report", icon: iconOf("/app/cvicenia"), match: (path) => path.startsWith("/ukazka/report") },
  { href: "/ukazka/historia", label: "História", icon: iconOf("/app/historia"), match: (path) => path.startsWith("/ukazka/historia") || path.startsWith("/ukazka/porovnanie") },
];
