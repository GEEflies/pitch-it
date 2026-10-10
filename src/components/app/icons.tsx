import type { SVGProps } from "react";

/* Ikony aplikácie: 24×24, ťah 1.75, zaoblené konce. Farbu berú z currentColor. */

const PATHS = {
  home: "M3.5 10.6 12 3.8l8.5 6.8M5.8 8.9V19a1 1 0 0 0 1 1h3.4v-5.4h3.6V20h3.4a1 1 0 0 0 1-1V8.9",
  presentation: "M3 4.5h18M4.5 4.5v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-10M12 15.5v2.7M8.5 21l3.5-2.8 3.5 2.8M8 12l2.6-2.6 2.1 2.1L16 8.2",
  mic: "M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3ZM6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6",
  chat: "M5 4.8h14a1.5 1.5 0 0 1 1.5 1.5v9.4a1.5 1.5 0 0 1-1.5 1.5h-8.2L6 20.6v-3.4H5a1.5 1.5 0 0 1-1.5-1.5V6.3A1.5 1.5 0 0 1 5 4.8ZM8.6 11h.01M12 11h.01M15.4 11h.01",
  file: "M14 3.5H7.2a1.7 1.7 0 0 0-1.7 1.7v13.6a1.7 1.7 0 0 0 1.7 1.7h9.6a1.7 1.7 0 0 0 1.7-1.7V8L14 3.5ZM14 3.5V8h4.5M9 12.5h6M9 16h6M9 9h2.2",
  trendUp: "M3.5 16.5 9 11l4 4 7.5-7.5M15 7.5h5.5V13",
  settings:
    "M12 2.9 13.7 5l2.6-.7.8 2.5 2.5.8-.7 2.6L21.1 12 19 13.7l.7 2.6-2.5.8-.8 2.5-2.6-.7L12 21.1 10.3 19l-2.6.7-.8-2.5-2.5-.8.7-2.6L2.9 12 5 10.3l-.7-2.6 2.5-.8.8-2.5 2.6.7L12 2.9ZM12 8.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z",
  bell: "M6 16.6V11a6 6 0 1 1 12 0v5.6l1.6 2H4.4l1.6-2ZM10 20.6a2 2 0 0 0 4 0",
  chevronDown: "m6.5 9.5 5.5 5.5 5.5-5.5",
  chevronRight: "m9.5 6 6 6-6 6",
  arrowRight: "M4.5 12h15M13.5 6l6 6-6 6",
  arrowUp: "M12 19V5.5M6.5 11 12 5.5l5.5 5.5",
  arrowDown: "M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5",
  star: "m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z",
  gauge: "M4.6 17.6a8.5 8.5 0 1 1 14.8 0M12 13.6l3.6-4.1M12 13.6h.01M7.2 9.6l.9.6M12 6.7v1.1M16.8 9.6l-.9.6",
  bulb: "M9.2 17.5h5.6M10.2 20.8h3.6M12 3.2a5.8 5.8 0 0 0-3.4 10.5c.6.5 1 1.2 1 2v1.8h4.8v-1.8c0-.8.4-1.5 1-2A5.8 5.8 0 0 0 12 3.2Z",
  bulbRays:
    "M9.6 17.5h4.8M10.4 20.6h3.2M12 6.2a4.6 4.6 0 0 0-2.7 8.3c.5.4.8 1 .8 1.6v1.4h3.8v-1.4c0-.6.3-1.2.8-1.6A4.6 4.6 0 0 0 12 6.2ZM12 2.4v1.4M5.3 5.2l1 1M18.7 5.2l-1 1M3.4 11h1.4M19.2 11h1.4",
  timer: "M12 20.8a7.3 7.3 0 1 0 0-14.6 7.3 7.3 0 0 0 0 14.6ZM12 9.8v3.7l2.4 1.5M9.6 2.8h4.8M18.6 6.2l1.4-1.4",
  check: "m7.5 12.4 3 3 6-6.4",
  lock: "M6.5 10.5h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7M12 14.5v2.5",
  bolt: "M13.2 2.8 5.2 13.6h6.1l-1 7.6 8-10.8h-6.1l1-7.6Z",
  flag: "M5.5 21V3.8M5.5 4.5h11.2l-2.2 3.6 2.2 3.6H5.5",
  mountain: "M3 19.5 8.6 11l3.6 4.6 2.8-3.6 6 7.5H3ZM15.5 7.5V3.8l3 1.1-3 1.1",
  coins:
    "M12 3.6c4 0 7.3 1.3 7.3 3s-3.3 3-7.3 3-7.3-1.3-7.3-3 3.3-3 7.3-3ZM4.7 6.6v5.1c0 1.7 3.3 3 7.3 3s7.3-1.3 7.3-3V6.6M4.7 11.7v5.1c0 1.7 3.3 3 7.3 3s7.3-1.3 7.3-3v-5.1",
  users: "M9 11.2a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM3 19.6c.6-3.2 3-5.1 6-5.1s5.4 1.9 6 5.1M15.6 4.6a3.4 3.4 0 0 1 0 6.4M17.6 14.7c1.8.7 3 2.4 3.4 4.9",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  logout: "M14 4.5h3.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14M9.5 8 5.5 12l4 4M5.5 12H15",
  card: "M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h14a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-11ZM3.5 10h17M7 15h3",
  user: "M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c.8-3.6 3.8-6 7.5-6s6.7 2.4 7.5 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "size-6",
  strokeWidth = 1.75,
  ...rest
}: { name: IconName; className?: string; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`} {...rest}>
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Plný trojuholník „prehrať“ v tlačidle. */
export function PlayIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <path d="M7.5 4.9v14.2c0 .8.9 1.3 1.6.9l11-7.1c.6-.4.6-1.4 0-1.8l-11-7.1c-.7-.4-1.6.1-1.6.9Z" fill="currentColor" />
    </svg>
  );
}
