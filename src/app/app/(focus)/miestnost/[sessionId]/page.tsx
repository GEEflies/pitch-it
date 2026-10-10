import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TrainingRoom } from "@/components/session/training-room";
import { getAnthropicConfig } from "@/config/server-env";
import { requireUser } from "@/lib/auth/session";
import { getCurrentConsents } from "@/lib/db/profile";
import { getProject } from "@/lib/db/projects";
import { findOwnedSession, listTurns } from "@/lib/db/sessions";
import { COACH_FOCUS_OPTIONS, isOneOf, type CoachFocus } from "@/lib/domain/labels";
import { INVESTOR_STYLES, SCENARIOS, isInvestorKey, isScenarioKey } from "@/lib/investor/catalog";
import { MEDIA_CONSENT_VERSION } from "@/lib/privacy/consent-texts";
import type { LiveTurn } from "@/lib/session/live-state";
import { isUuid } from "@/lib/validation/ids";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Tréningová miestnosť" };

export default async function RoomPage({ params }: PageProps<"/app/miestnost/[sessionId]">) {
  const { sessionId } = await params;
  const user = await requireUser(`/app/miestnost/${sessionId}`);
  if (!isUuid(sessionId)) notFound();

  const session = await findOwnedSession(sessionId, user.id);
  if (!session) notFound();
  if (session.status !== "ready" && session.status !== "live") redirect(`/app/trening/${session.id}`);

  const [project, turns, consents] = await Promise.all([
    getProject(session.project_id),
    session.status === "live" ? listTurns(session.id) : Promise.resolve([]),
    getCurrentConsents(user.id),
  ]);

  const initialTurns: LiveTurn[] = turns.map((turn) => ({
    seq: turn.seq,
    speaker: turn.speaker,
    itemId: turn.provider_item_id,
    responseId: null,
    text: turn.text,
    final: true,
    interrupted: turn.interrupted,
    failed: turn.speaker === "founder" && turn.source === "realtime" && turn.text.trim() === "",
    startedMs: turn.started_ms,
    endedMs: turn.ended_ms,
    source: turn.source,
  }));

  const consentCurrent = (kind: "microphone_processing" | "camera_analysis") =>
    consents[kind]?.granted === true && consents[kind]?.version === MEDIA_CONSENT_VERSION;

  const investorName = isInvestorKey(session.investor_key) ? INVESTOR_STYLES[session.investor_key].name : "Investor";
  const scenarioName = isScenarioKey(session.scenario_key) ? SCENARIOS[session.scenario_key].name : "Tréning";

  return (
    <TrainingRoom
      sessionId={session.id}
      mode={session.mode}
      transport={session.transport}
      cameraEnabled={session.camera_enabled}
      coachFocus={session.coach_focus.filter((focus): focus is CoachFocus => isOneOf(COACH_FOCUS_OPTIONS, focus))}
      targetDurationSeconds={session.target_duration_seconds}
      initialTurns={initialTurns}
      projectName={project?.name ?? "Projekt"}
      investorName={investorName}
      scenarioName={scenarioName}
      micConsentGiven={consentCurrent("microphone_processing")}
      cameraConsentGiven={consentCurrent("camera_analysis")}
      textAvailable={getAnthropicConfig() !== null}
    />
  );
}
