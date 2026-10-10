import { SetupForm } from "@/components/session/setup-form";
import { PageHeader } from "@/components/ui/page-header";
import { PLANS } from "@/lib/billing/plans";
import { PREVIEW_PROJECT } from "@/lib/preview/fixtures";

export default function PreviewSetup() {
  return (
    <>
      <PageHeader
        title="Nový tréning"
        description="Vyber, s kým a na aké stretnutie sa pripravuješ. Mikrofón a kameru nastavíš v ďalšom kroku."
      />
      <SetupForm
        projects={[PREVIEW_PROJECT]}
        defaults={{
          projectId: PREVIEW_PROJECT.id,
          mode: "coach",
          investorKey: "market",
          scenarioKey: "first_meeting",
          coachFocus: ["pace", "answer_length"],
          previousSessionId: null,
          exerciseId: null,
        }}
        realtimeAvailable
        textAvailable
        remainingMinutes={10}
        maxSessionMinutes={PLANS.free.limits.maxSessionMinutes}
        exerciseTitle={null}
        previewRoomHref="/ukazka/miestnost"
      />
    </>
  );
}
