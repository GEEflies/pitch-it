import Link from "next/link";
import { siteConfig } from "@/config/site";

/** Dočasná neutrálna značka. Logo dodá brand: nahradí sa iba tento súbor. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[7px] bg-panel-2 ring-1 ring-line-strong ${className}`}
    >
      <span className="size-[38%] rounded-[3px] bg-paper" />
    </span>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-md text-paper ${className}`}
      aria-label={`${siteConfig.name} – domov`}
    >
      <LogoMark className="size-7" />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{siteConfig.name}</span>
    </Link>
  );
}
