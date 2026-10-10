import Link from "next/link";
import { siteConfig } from "@/config/site";

/** Znak PitchIt: horný oblúk, stĺpik a trojuholník (docs/brand/logo-mark-dark.svg). */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-4 -4 216 292" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M8 52C5 42 10 36 20 31L52 6C62 -1 72 0 82 4L158 41C190 57 212 90 205 126C202 146 193 158 185 165C183 149 178 140 168 134L12 58C10 57 9 55 8 52Z"
        fill="#AAFF00"
      />
      <path d="M73 100V214C73 232 64 242 50 250L9 281C5 284 2 282 2 278V140C2 128 8 120 18 114Z" fill="#7AB800" />
      <path d="M99 130L166 161L101 211Z" fill="#D2FF6B" stroke="#D2FF6B" strokeWidth="10" strokeLinejoin="round" />
    </svg>
  );
}

/** Wordmark: „Pitch“ vo farbe textu, „It“ v akcente, písmo Outfit. */
export function Wordmark({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 rounded-md text-paper ${className}`}
      aria-label={`${siteConfig.name} – domov`}
    >
      <LogoMark className="h-7 w-auto" />
      <span className="font-wordmark text-[22px] leading-none font-bold tracking-[-0.03em]">
        Pitch<span className="text-accent">It</span>
      </span>
    </Link>
  );
}
