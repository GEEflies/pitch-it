"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/submit-button";
import {
  describeMediaError,
  listDevices,
  openCamera,
  openMicrophone,
  playTestTone,
  rememberDevice,
  rememberedDevice,
} from "@/components/session/media";
import { recordMediaConsentAction } from "@/lib/privacy/actions";
import { CAMERA_CONSENT, MICROPHONE_CONSENT } from "@/lib/privacy/consent-texts";
import type { LiveSessionController, RoomSnapshot } from "@/lib/session/controller";

function LevelMeter({ level }: { level: number }) {
  const bars = 16;
  const active = Math.round(level * bars);
  return (
    <div className="flex h-6 items-end gap-[3px]" role="meter" aria-label="Úroveň mikrofónu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full transition-colors duration-75 ${index < active ? (index > 12 ? "bg-marker" : "bg-mint") : "bg-line"}`}
          style={{ height: `${30 + (index / bars) * 70}%` }}
        />
      ))}
    </div>
  );
}

function ConsentRow({
  label,
  points,
  checked,
  onChange,
  id,
}: {
  label: string;
  points: readonly string[];
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
}) {
  return (
    <div className="border-t border-line/70 pt-4">
      <label htmlFor={id} className="flex items-start gap-3 text-[14.5px] leading-snug text-paper">
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-signal" />
        {label}
      </label>
      <details className="group mt-2 pl-[30px]">
        <summary className="cursor-pointer list-none text-[13px] text-faint hover:text-mute">
          <span className="group-open:hidden">Čo presne spracúvame</span>
          <span className="hidden group-open:inline">Skryť podrobnosti</span>
        </summary>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-mute">
          {points.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[0.65em] h-px w-2.5 shrink-0 bg-signal-soft" />
              {point}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function DeviceCard({
  title,
  status,
  action,
  children,
  labelledBy,
}: {
  title: ReactNode;
  status: "ready" | "off" | "idle";
  action?: ReactNode;
  children: ReactNode;
  labelledBy: string;
}) {
  const dot = status === "ready" ? "bg-signal" : status === "off" ? "bg-line-strong" : "bg-marker";
  return (
    <section aria-labelledby={labelledBy} className="flex flex-col gap-4 rounded-[14px] border border-line bg-panel/60 p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 id={labelledBy} className="flex items-center gap-2.5 font-medium text-paper">
          <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Preflight({
  controller,
  snapshot,
  cameraEnabled,
  micConsentGiven,
  cameraConsentGiven,
  onCameraStream,
  onCameraDeclined,
  isText,
  preview = false,
}: {
  controller: LiveSessionController;
  snapshot: RoomSnapshot;
  cameraEnabled: boolean;
  micConsentGiven: boolean;
  cameraConsentGiven: boolean;
  onCameraStream: (stream: MediaStream | null) => void;
  onCameraDeclined: () => void;
  isText: boolean;
  preview?: boolean;
}) {
  const id = useId();
  const [micConsent, setMicConsent] = useState(micConsentGiven);
  const [cameraConsent, setCameraConsent] = useState(cameraConsentGiven);
  const [micReady, setMicReady] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [useCamera, setUseCamera] = useState(cameraEnabled);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const enableMic = useCallback(
    async (deviceId: string | null) => {
      setMicBusy(true);
      setMicError(null);
      try {
        const stream = await openMicrophone(deviceId);
        await controller.attachMicrophone(stream);
        setMicReady(true);
        const devices = await listDevices("audioinput");
        setMics(devices);
        const active = stream.getAudioTracks()[0]?.getSettings().deviceId ?? null;
        setMicId(active);
        if (active) rememberDevice("mic", active);
      } catch (error) {
        setMicReady(false);
        setMicError(describeMediaError(error, "mikrofón").message);
      } finally {
        setMicBusy(false);
      }
    },
    [controller],
  );

  const enableCamera = useCallback(
    async (deviceId: string | null) => {
      setCameraError(null);
      try {
        cameraStream?.getTracks().forEach((track) => track.stop());
        const stream = await openCamera(deviceId);
        setCameraStream(stream);
        onCameraStream(stream);
        setCameras(await listDevices("videoinput"));
        const active = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
        setCameraId(active);
        if (active) rememberDevice("camera", active);
      } catch (error) {
        setCameraError(describeMediaError(error, "kamera").message);
        onCameraStream(null);
      }
    },
    [cameraStream, onCameraStream],
  );

  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  const canStart = isText || preview || (micReady && micConsent && (!useCamera || (cameraConsent && Boolean(cameraStream))));

  const start = async () => {
    setStarting(true);
    if (!isText && !preview) {
      if (!micConsentGiven) await recordMediaConsentAction("microphone_processing", true);
      if (useCamera && !cameraConsentGiven) await recordMediaConsentAction("camera_analysis", true);
    }
    if (cameraEnabled && !useCamera) onCameraDeclined();
    await controller.start();
    setStarting(false);
  };

  if (isText) {
    return (
      <div className="max-w-[36rem]">
        <p className="leading-relaxed text-mute">
          Investor ti napíše prvú otázku. Odpovedaj rovnako ako na skutočnom stretnutí. Rozbor dostaneš po ukončení.
        </p>
        {snapshot.error ? <Notice tone="error" className="mt-6">{snapshot.error}</Notice> : null}
        <button type="button" onClick={start} disabled={starting} className={buttonClasses({ size: "lg", className: "mt-8" })}>
          {starting ? <Spinner /> : null}
          Začať textový tréning
        </button>
      </div>
    );
  }

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    onCameraStream(null);
    setUseCamera(false);
  };

  return (
    <div className="space-y-6">
      <div className={`grid gap-5 ${cameraEnabled ? "lg:grid-cols-2" : "max-w-[34rem]"}`}>
        <DeviceCard labelledBy={`${id}-mic`} title="Mikrofón" status={micReady ? "ready" : "idle"}>
          {!micReady ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-line-strong bg-ink-2/60 p-6 text-center">
              <p className="text-[14px] text-mute">Investor ťa potrebuje počuť.</p>
              <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => enableMic(rememberedDevice("mic"))} disabled={micBusy}>
                {micBusy ? <Spinner /> : null}
                Povoliť mikrofón
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {mics.length > 1 ? (
                <Select aria-label="Mikrofón" value={micId ?? ""} onChange={(event) => void enableMic(event.target.value || null)}>
                  {mics.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Mikrofón ${index + 1}`}
                    </option>
                  ))}
                </Select>
              ) : null}
              <div className="flex items-center justify-between gap-4 rounded-[10px] bg-ink-2/60 px-4 py-3">
                <span className="text-[14px] text-mute">Povedz pár slov</span>
                <LevelMeter level={snapshot.micLevel} />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex flex-1 items-center gap-3 text-[13px] text-mute">
                  Hlasitosť investora
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={snapshot.speakerVolume}
                    onChange={(event) => controller.setSpeakerVolume(Number(event.target.value))}
                    className="flex-1 accent-signal"
                  />
                </label>
                <button type="button" className={buttonClasses({ variant: "ghost", className: "h-8 px-2.5 text-[13px]" })} onClick={() => void playTestTone(snapshot.speakerVolume)}>
                  Skúšobný tón
                </button>
              </div>
              <p className="text-[13px] text-faint">Tip: so slúchadlami ťa investor nepočuje vlastným hlasom.</p>
            </div>
          )}
          {micError ? <Notice tone="error">{micError}</Notice> : null}
          {!micConsentGiven ? (
            <ConsentRow
              id={`${id}-mic-consent`}
              label="Súhlasím, že hlas sa posiela AI na prepis. Nahrávku neukladáme."
              points={MICROPHONE_CONSENT.points}
              checked={micConsent}
              onChange={setMicConsent}
            />
          ) : null}
        </DeviceCard>

        {cameraEnabled ? (
          <DeviceCard
            labelledBy={`${id}-camera`}
            title={
              <>
                Kamera <span className="text-[13px] font-normal text-faint">voliteľné</span>
              </>
            }
            status={!useCamera ? "off" : cameraStream ? "ready" : "idle"}
            action={
              useCamera ? (
                <button type="button" className="text-[13px] text-mute underline-offset-4 hover:text-paper hover:underline" onClick={stopCamera}>
                  Bez kamery
                </button>
              ) : null
            }
          >
            {useCamera && cameraStream ? (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full -scale-x-100 rounded-[10px] bg-ink-2 object-cover"
                />
                {cameras.length > 1 ? (
                  <Select aria-label="Kamera" value={cameraId ?? ""} onChange={(event) => void enableCamera(event.target.value || null)}>
                    {cameras.map((device, index) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Kamera ${index + 1}`}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <p className="text-[13px] text-faint">Tvár v strede, ramená v zábere.</p>
              </div>
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-line-strong bg-ink-2/60 p-6 text-center">
                <p className="max-w-[22rem] text-[14px] text-mute">
                  {useCamera ? "V rozbore uvidíš aj pohľad, postoj a gestá." : "Tréning funguje aj bez kamery, v rozbore len chýbajú neverbálne signály."}
                </p>
                <button
                  type="button"
                  className={buttonClasses({ variant: "secondary" })}
                  onClick={() => {
                    setUseCamera(true);
                    void enableCamera(rememberedDevice("camera"));
                  }}
                >
                  Zapnúť kameru
                </button>
              </div>
            )}
            {cameraError ? <Notice tone="error">{cameraError}</Notice> : null}
            {useCamera && !cameraConsentGiven ? (
              <ConsentRow
                id={`${id}-camera-consent`}
                label="Súhlasím s analýzou obrazu priamo v prehliadači. Video sa nikam neposiela."
                points={CAMERA_CONSENT.points}
                checked={cameraConsent}
                onChange={setCameraConsent}
              />
            ) : null}
          </DeviceCard>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-faint">
          {snapshot.error ? (
            <span className="text-coral">{snapshot.error}</span>
          ) : preview ? (
            "Ukážka prehrá vzorový rozhovor. Mikrofón a kameru si môžeš vyskúšať naostro."
          ) : !micReady ? (
            "Najprv povoľ mikrofón."
          ) : !micConsent ? (
            "Potvrď súhlas s hlasovým rozhovorom."
          ) : useCamera && !(cameraConsent && cameraStream) ? (
            "Zapni kameru a potvrď súhlas, alebo pokračuj bez nej."
          ) : (
            "Všetko je pripravené."
          )}
        </div>
        <button type="button" onClick={start} disabled={!canStart || starting} className={buttonClasses({ size: "lg" })}>
          {starting ? <Spinner /> : null}
          {preview ? "Spustiť ukážku rozhovoru" : "Začať rozhovor"}
        </button>
      </div>
    </div>
  );
}
