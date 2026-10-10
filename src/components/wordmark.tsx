import Link from "next/link";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M5 4h18a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H11.5L6 24.5V20H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
        fill="var(--color-signal)"
      />
      <rect x="6" y="8.5" width="10" height="3.2" rx="1.6" fill="var(--color-marker)" />
      <rect x="6" y="13.6" width="14" height="2" rx="1" fill="#fff" fillOpacity="0.75" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-2 rounded-md text-paper ${className}`}
      aria-label="Pitch It – domov"
    >
      <LogoMark className="size-7 transition-transform duration-300 ease-out group-hover:-rotate-6" />
      <span className="type-heading text-[1.3rem] leading-none tracking-[-0.03em]">
        Pitch It
      </span>
    </Link>
  );
}
