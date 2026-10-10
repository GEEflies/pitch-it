import { ReportView } from "@/components/report/report-view";
import { PREVIEW_EXERCISES, PREVIEW_PROJECT, PREVIEW_REPORT, PREVIEW_SESSION, PREVIEW_TURNS } from "@/lib/preview/fixtures";

export default function PreviewReport() {
  return (
    <ReportView
      preview
      session={PREVIEW_SESSION}
      projectName={PREVIEW_PROJECT.name}
      report={PREVIEW_REPORT}
      turns={PREVIEW_TURNS}
      sessionExercises={PREVIEW_EXERCISES}
      links={{
        history: "/ukazka/historia",
        retest: "/ukazka/novy-trening",
        materials: "/ukazka/podklady",
        exercises: "/ukazka/report#plan",
        exercise: () => "/ukazka/report#plan",
      }}
    />
  );
}
