import { HistoryView } from "@/components/history/history-view";
import { PREVIEW_COMPARABLE, PREVIEW_HISTORY } from "@/lib/preview/fixtures";
import { previewHref } from "@/lib/preview/links";

export default function PreviewProgress() {
  return (
    <HistoryView
      sessions={PREVIEW_HISTORY}
      comparable={PREVIEW_COMPARABLE}
      mode="coach"
      counts={{ coach: PREVIEW_HISTORY.length, simulation: 0, delivery: 0 }}
      href={previewHref}
      view="trends"
    />
  );
}
