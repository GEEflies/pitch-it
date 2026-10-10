import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/db/profile";
import { getBillingContext } from "@/lib/db/usage";

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Plán a účet v spodnej časti navigácie. Číta reláciu, preto je vždy vo vnútri <Suspense>. */
export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [profile, billing] = await Promise.all([getProfile(user.id), getBillingContext(user.id)]);
  const name = profile?.display_name ?? null;
  const used = Math.ceil(billing.usage.realtime_seconds / 60);
  const limit = billing.plan.limits.realtimeMinutes;
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;

  return (
    <div className="space-y-3">
      <div className="surface-card rounded-xl px-3 py-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-paper">Plán {billing.plan.name}</span>
          <span className="tabular-nums text-mute">
            {used}/{limit} min
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className={`h-full rounded-full ${used >= limit ? "bg-marker" : "bg-signal"}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        {billing.plan.id === "free" ? (
          <Link href="/app/nastavenia#plan" className="mt-2.5 block text-xs font-bold text-signal-soft hover:text-paper">
            Prejsť na Pro →
          </Link>
        ) : null}
      </div>

      <details className="group relative">
        <summary className="flex list-none items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-panel [&::-webkit-details-marker]:hidden">
          <span
            aria-hidden="true"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-panel-2 text-[11px] font-semibold text-paper ring-1 ring-line-strong"
          >
            {initials(name, user.email ?? null)}
          </span>
          <span className="min-w-0 flex-1">
            {name ? <span className="block truncate text-sm font-medium text-paper">{name}</span> : null}
            <span className="block truncate text-xs text-mute" title={user.email ?? undefined}>
              {user.email}
            </span>
          </span>
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180">
            <path d="m6 12 4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="absolute inset-x-0 bottom-full z-50 mb-1 rounded-xl border border-line bg-panel p-1 shadow-[var(--shadow-card)]">
          <div className="px-1.5 pt-1.5 pb-2">
            <ThemeToggle />
          </div>
          <Link href="/app/nastavenia" className="block rounded-md px-2.5 py-1.5 text-sm text-mute hover:bg-panel-2 hover:text-paper">
            Nastavenia účtu
          </Link>
          <Link href="/app/nastavenia#plan" className="block rounded-md px-2.5 py-1.5 text-sm text-mute hover:bg-panel-2 hover:text-paper">
            Plán a platby
          </Link>
          <form action={signOut}>
            <button type="submit" className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-mute hover:bg-panel-2 hover:text-paper">
              Odhlásiť sa
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
