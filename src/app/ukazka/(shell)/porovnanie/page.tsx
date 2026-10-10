import { CompareView } from "@/components/history/compare-view";
import { TRAINING_MODE_LABELS } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";
import { compareSessions } from "@/lib/history/compare";
import { PREVIEW_COMPARABLE } from "@/lib/preview/fixtures";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export default async function PreviewCompare({ searchParams }: PageProps<"/ukazka/porovnanie">) {
  const params = await searchParams;
  const pick = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const before = PREVIEW_COMPARABLE.find((session) => session.id === pick(params.a)) ?? PREVIEW_COMPARABLE[0];
  const after = PREVIEW_COMPARABLE.find((session) => session.id === pick(params.b)) ?? PREVIEW_COMPARABLE[PREVIEW_COMPARABLE.length - 1];
  return (
    <CompareView
      comparison={compareSessions(before, after)}
      description={`${TRAINING_MODE_LABELS[before.mode]}: ${formatDateTime(before.createdAt)} oproti ${formatDateTime(after.createdAt)}.`}
      backHref="/ukazka/historia"
    />
  );
}
