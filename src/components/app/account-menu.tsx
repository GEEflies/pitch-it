import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";

/** Účet v navigácii. Číta reláciu, preto je vždy vo vnútri <Suspense>. */
export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="space-y-2">
      <p className="truncate px-1 text-sm text-mute" title={user.email ?? undefined}>
        {user.email}
      </p>
      <div className="flex items-center gap-1">
        <Link href="/app/nastavenia" className="rounded-md px-1 py-1 text-sm text-faint hover:text-paper">
          Účet
        </Link>
        <span aria-hidden="true" className="text-line-strong">/</span>
        <form action={signOut}>
          <button type="submit" className="rounded-md px-1 py-1 text-sm text-faint hover:text-paper">
            Odhlásiť sa
          </button>
        </form>
      </div>
    </div>
  );
}
