import { TrainingRoom } from "@/components/session/training-room";
import { INVESTOR_STYLES, SCENARIOS } from "@/lib/investor/catalog";
import { PREVIEW_HINT, PREVIEW_PROJECT, PREVIEW_ROOM_SCRIPT, PREVIEW_SESSION_ID } from "@/lib/preview/fixtures";

export default function PreviewRoom() {
  return (
    <TrainingRoom
      sessionId={PREVIEW_SESSION_ID}
      mode="coach"
      transport="realtime"
      cameraEnabled
      coachFocus={["pace", "answer_length", "camera_gaze"]}
      targetDurationSeconds={12 * 60}
      initialTurns={[]}
      projectName={PREVIEW_PROJECT.name}
      investorName={INVESTOR_STYLES.market.name}
      scenarioName={SCENARIOS.first_meeting.name}
      micConsentGiven={false}
      cameraConsentGiven={false}
      textAvailable={false}
      preview={{ script: PREVIEW_ROOM_SCRIPT, hint: PREVIEW_HINT, reportUrl: "/ukazka/report" }}
    />
  );
}
