"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { HintPanel } from "@/components/session/hint-panel";
import { InvestorStage, StatusPill } from "@/components/session/investor-stage";
import { Preflight } from "@/components/session/preflight";
import { TextComposer } from "@/components/session/text-composer";
import { Transcript } from "@/components/session/transcript";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Notice } from "@/components/ui/notice";
import { formatClock } from "@/lib/format";
import type { CoachFocus, TrainingMode } from "@/lib/domain/labels";
import { LiveSessionController, type RoomConfig, type RoomSnapshot } from "@/lib/session/controller";
import type { LiveTurn } from "@/lib/session/live-state";

export type TrainingRoomProps = {
  sessionId: string;
  mode: TrainingMode;
  transport: "realtime" | "text";
  cameraEnabled: boolean;
  coachFocus: CoachFocus[];
  targetDurationSeconds: number;
  initialTurns: LiveTurn[];
  projectName: string;
  investorName: string;
  scenarioName: string;
  micConsentGiven: boolean;
  cameraConsentGiven: boolean;
  textAvailable: boolean;
  preview?: RoomConfig["preview"];
};

function Timer({ elapsed, limit }: { elapsed: number; limit: number | null }) {
  const remaining = limit === null ? null : Math.max(0, limit - elapsed);
  const urgent = remaining !== null && remaining <= 60;
  return (
    <span className={`tabular-nums text-[15px] ${urgent ? "text-marker" : "text-paper"}`} aria-label={limit ? `Uplynulo ${formatClock(elapsed)} z ${formatClock(limit)}` : `Uplynulo ${formatClock(elapsed)}`}>
      {formatClock(elapsed)}
      {limit !== null ? <span className="text-faint"> / {formatClock(limit)}</span> : null}
    </span>
  );
}

function MicButton({ muted, level, onToggle }: { muted: boolean; level: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={muted ? "Zapnúť mikrofón" : "Stlmiť mikrofón"}
      className={`relative inline-flex h-11 items-center gap-2 rounded-[10px] border px-3.5 text-sm transition-colors ${
        muted ? "border-coral/60 bg-coral/10 text-coral" : "border-line-strong text-paper hover:bg-panel"
      }`}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
        <path
          d="M10 3a2.6 2.6 0 0 1 2.6 2.6v4a2.6 2.6 0 0 1-5.2 0v-4A2.6 2.6 0 0 1 10 3ZM5.2 9.6a4.8 4.8 0 0 0 9.6 0M10 14.4V17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {muted ? <path d="M4 4l12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : null}
      </svg>
      {muted ? "Stlmené" : (
        <span aria-hidden="true" className="h-1.5 w-10 overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-mint transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
        </span>
      )}
    </button>
  );
}

function CameraPreview({ stream, status }: { stream: MediaStream | null; status: RoomSnapshot["vision"] }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  if (!stream) return null;
  const label =
    status.status === "running" ? "Analýza beží v prehliadači" : status.status === "loading" ? "Načítavam analýzu…" : status.status === "failed" ? "Analýza nebeží" : "";
  return (
    <figure className="w-36 shrink-0">
      <video ref={ref} autoPlay muted playsInline className="aspect-[4/3] w-full -scale-x-100 rounded-[10px] border border-line-strong bg-ink-2 object-cover" />
      <figcaption className={`mt-1 text-[11.5px] ${status.status === "failed" ? "text-marker" : "text-faint"}`} title={status.error ?? undefined}>
        {label}
      </figcaption>
    </figure>
  );
}

export function TrainingRoom(props: TrainingRoomProps) {
  // Konfigurácia sa počas života stránky nemení; kontrolér vznikne raz.
  const [controller] = useState(() => {
    const config: RoomConfig = {
      sessionId: props.sessionId,
      mode: props.mode,
      transport: props.transport,
      cameraEnabled: props.cameraEnabled,
      coachFocus: props.coachFocus,
      targetDurationSeconds: props.targetDurationSeconds,
      initialTurns: props.initialTurns,
      preview: props.preview,
    };
    return new LiveSessionController(config);
  });

  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);

  return <Room controller={controller} {...props} />;
}

function Room({ controller, ...props }: TrainingRoomProps & { controller: LiveSessionController }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  const analysisVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(props.cameraEnabled);
  const delivery = props.mode === "delivery";
  const { live, stage } = snapshot;

  useEffect(() => {
    if (audioRef.current) controller.setAudioElement(audioRef.current);
  }, [controller]);

  // Analýza kamery beží iba počas živého rozhovoru.
  useEffect(() => {
    const video = analysisVideoRef.current;
    if (stage !== "live" || !cameraActive || !cameraStream || !video) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => undefined);
    void controller.attachCamera(video);
    return () => controller.detachCamera();
  }, [stage, cameraActive, cameraStream, controller]);

  useEffect(() => {
    if (stage === "ended" && snapshot.reportUrl) router.push(snapshot.reportUrl);
  }, [stage, snapshot.reportUrl, router]);

  useEffect(() => {
    if (stage !== "live" && stage !== "reconnecting" && stage !== "connecting") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  useEffect(() => () => cameraStream?.getTracks().forEach((track) => track.stop()), [cameraStream]);

  const lastInvestor = [...live.turns].reverse().find((turn) => turn.speaker === "investor" && turn.text.trim());
  const founderPartial = live.founderItemId
    ? (live.turns.find((turn) => turn.itemId === live.founderItemId)?.text ?? "")
    : null;
  const inRoom = stage !== "preflight";
  const isText = snapshot.transport === "text";
  const hasFounderTurns = live.turns.some((turn) => turn.speaker === "founder");

  return (
    <div className="flex min-h-dvh flex-col">
      <audio ref={audioRef} autoPlay className="hidden" />
      <video ref={analysisVideoRef} muted playsInline className="hidden" aria-hidden="true" />

      <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/95">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-4 px-4 md:px-8">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-paper">{props.projectName}</p>
            <p className="truncate text-[13px] text-faint">{delivery ? props.scenarioName : `${props.investorName}, ${props.scenarioName.toLowerCase()}`}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 md:gap-5">
            {inRoom ? <StatusPill stage={stage} phase={live.phase} delivery={delivery} /> : null}
            {inRoom ? <Timer elapsed={snapshot.elapsedSeconds} limit={isText ? null : snapshot.limitSeconds} /> : null}
            {!inRoom ? (
              <Link href="/app" className={buttonClasses({ variant: "ghost", className: "h-10" })}>
                Späť
              </Link>
            ) : stage === "live" || stage === "reconnecting" || (stage === "failed" && !snapshot.canRetryFinish) ? (
              <ConfirmAction
                trigger="Ukončiť"
                tone="default"
                triggerClassName={buttonClasses({ variant: "secondary", className: "h-10" })}
                title="Ukončiť tréning?"
                description={
                  hasFounderTurns
                    ? "Rozhovor sa uloží a pripravíme rozbor. Čas sa počíta po túto chvíľu."
                    : "Zatiaľ nezaznela žiadna tvoja odpoveď, rozbor preto nebude čo hodnotiť."
                }
                confirmLabel="Ukončiť a zobraziť rozbor"
                pendingLabel="Ukladám…"
                action={async () => {
                  await controller.end("user_ended");
                }}
              />
            ) : null}
          </div>
        </div>
      </header>

      <main id="obsah" className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 md:px-8 md:py-10">
        {!inRoom ? (
          <div className="mx-auto max-w-[64rem]">
            <p className="text-[13px] font-medium uppercase tracking-[0.12em] text-faint">Pred rozhovorom</p>
            <h1 className="type-display mt-2 text-[clamp(1.75rem,1.4rem+1.2vw,2.25rem)]">
              {isText ? "Textový tréning" : props.cameraEnabled ? "Skontroluj mikrofón a kameru" : "Skontroluj mikrofón"}
            </h1>
            <p className="mt-2 max-w-[40rem] leading-relaxed text-mute">
              {delivery
                ? "Po spustení odprezentuj celý pitch. Investor počúva a nevstupuje do toho."
                : isText
                  ? `${props.investorName} sa bude pýtať písomne.`
                  : `${props.investorName} sa ozve hneď po spustení. Kedykoľvek ho môžeš prerušiť.`}
            </p>
            <div className="mt-8">
              <Preflight
                controller={controller}
                snapshot={snapshot}
                cameraEnabled={props.cameraEnabled}
                micConsentGiven={props.micConsentGiven}
                cameraConsentGiven={props.cameraConsentGiven}
                onCameraStream={setCameraStream}
                onCameraDeclined={() => setCameraActive(false)}
                isText={isText}
                preview={Boolean(props.preview)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="flex flex-col gap-6 lg:col-span-7">
              {stage === "reconnecting" ? (
                <Notice tone="attention" role="status" title="Spojenie sa prerušilo">
                  Obnovujem ho (pokus {live.reconnectAttempts} z 3). Rozhovor pokračuje tam, kde skončil.
                </Notice>
              ) : null}
              {stage === "failed" && snapshot.error ? (
                <Notice
                  tone="error"
                  title={snapshot.canRetryFinish ? "Tréning sa neuložil" : "Spojenie nefunguje"}
                  action={
                    <div className="flex flex-wrap gap-2">
                      {snapshot.canRetryFinish ? (
                        <button type="button" className={buttonClasses()} onClick={() => void controller.retryFinish()}>
                          Skúsiť uložiť znova
                        </button>
                      ) : (
                        <>
                          {!isText ? (
                            <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => void controller.retryConnection()}>
                              Skúsiť znova
                            </button>
                          ) : null}
                          {!isText && props.textAvailable && !delivery ? (
                            <button type="button" className={buttonClasses()} onClick={() => void controller.switchToText()}>
                              Pokračovať textom
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  }
                >
                  {snapshot.error}
                </Notice>
              ) : null}
              {stage === "ending" ? (
                <Notice tone="info" role="status" title="Ukladám rozhovor">
                  O chvíľu ťa presmerujem na rozbor.
                </Notice>
              ) : null}
              {snapshot.audioBlocked ? (
                <Notice
                  tone="attention"
                  title="Prehliadač zablokoval zvuk"
                  action={
                    <button type="button" className={buttonClasses()} onClick={() => void controller.resumeAudio()}>
                      Zapnúť zvuk investora
                    </button>
                  }
                />
              ) : null}

              <div className="rounded-[18px] border border-line bg-panel px-6 py-7 md:px-9 md:py-9">
                <InvestorStage
                  investorName={props.investorName}
                  line={lastInvestor?.text ?? null}
                  phase={live.phase}
                  stage={stage}
                  founderPartial={founderPartial}
                  delivery={delivery}
                />
              </div>

              <AnimatePresence>
                {snapshot.nudge ? (
                  <m.div
                    key={snapshot.nudge.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    role="status"
                    className="flex items-start justify-between gap-3 rounded-[12px] border border-marker/40 bg-marker/[0.07] px-4 py-3 text-[14.5px] text-paper"
                  >
                    <span>{snapshot.nudge.text}</span>
                    <button type="button" className="text-mute hover:text-paper" onClick={() => controller.dismissNudge()} aria-label="Skryť upozornenie">
                      ×
                    </button>
                  </m.div>
                ) : null}
              </AnimatePresence>

              {isText ? (
                <TextComposer
                  onSend={(text) => controller.sendText(text)}
                  pending={snapshot.textPending}
                  disabled={stage !== "live"}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <MicButton muted={snapshot.micMuted} level={snapshot.micLevel} onToggle={() => controller.toggleMicrophone()} />
                  <label className="flex items-center gap-2 text-sm text-mute">
                    <span>Hlasitosť</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={snapshot.speakerVolume}
                      onChange={(event) => controller.setSpeakerVolume(Number(event.target.value))}
                      className="w-28 accent-signal"
                      aria-label="Hlasitosť investora"
                    />
                  </label>
                  {live.investorSpeaking ? (
                    <span className="text-[13px] text-faint">Investora môžeš prerušiť, stačí začať hovoriť.</span>
                  ) : null}
                </div>
              )}
              {isText && snapshot.error && stage === "live" ? <Notice tone="error">{snapshot.error}</Notice> : null}

              <div className="flex flex-wrap items-start gap-6">
                {cameraActive ? <CameraPreview stream={cameraStream} status={snapshot.vision} /> : null}
                {props.mode === "coach" ? (
                  <div className="min-w-[16rem] flex-1">
                    <HintPanel hint={snapshot.hint} onRequest={() => void controller.requestHint()} disabled={stage !== "live"} />
                  </div>
                ) : null}
              </div>
              {snapshot.saving.failing ? (
                <p className="text-[13px] text-marker" role="status">
                  Prepis sa nepodarilo uložiť, skúšam znova ({snapshot.saving.pending} čaká).
                </p>
              ) : null}
            </div>

            <aside className="lg:col-span-5">
              <div className="rounded-[18px] border border-line bg-ink-2 p-5 lg:sticky lg:top-24">
                <h2 className="mb-4 text-[15px] font-semibold text-paper">Prepis</h2>
                <div className="h-[40vh] lg:h-[calc(100dvh-14rem)]">
                  <Transcript turns={live.turns} delivery={delivery} />
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
