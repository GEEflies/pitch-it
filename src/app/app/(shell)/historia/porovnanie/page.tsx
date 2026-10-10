import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompareView } from "@/components/history/compare-view";
import { requireUser } from "@/lib/auth/session";
import { listSessionsWithReports } from "@/lib/db/sessions";
import { TRAINING_MODE_LABELS } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";
import { compareSessions } from "@/lib/history/compare";
import { toComparable } from "@/lib/history/load";
import { isUuid } from "@/lib/validation/ids";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Porovnanie tréningov" };

export default async function ComparePage({ searchParams }: PageProps<"/app/historia/porovnanie">) {
  const user = await requireUser("/app/historia/porovnanie");
  const params = await searchParams;
  const a = Array.isArray(params.a) ? params.a[0] : params.a;
  const b = Array.isArray(params.b) ? params.b[0] : params.b;
  if (!isUuid(a) || !isUuid(b) || a === b) notFound();

  const rows = await listSessionsWithReports(user.id, [a, b]);
  const before = rows.find((row) => row.id === a);
  const after = rows.find((row) => row.id === b);
  if (!before || !after) notFound();

  return (
    <CompareView
      comparison={compareSessions(toComparable(before), toComparable(after))}
      description={`${TRAINING_MODE_LABELS[before.mode]}: ${formatDateTime(before.created_at)} oproti ${formatDateTime(after.created_at)}.`}
      backHref="/app/historia"
    />
  );
}
