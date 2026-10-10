"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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

function ConsentBlock({
  title,
  points,
  checked,
  onChange,
  id,
}: {
  title: string;
  points: readonly string[];
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
}) {
  return (
    <div className="rounded-[12px] border border-line-strong p-4">
      <p className="font-medium text-paper">{title}</p>
      <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-mute">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-[0.65em] h-px w-3 shrink-0 bg-signal-soft" />
            {point}
          </li>
        ))}
      </ul>
      <label htmlFor={id} className="mt-4 flex items-start gap-3 text-[14.5px] text-paper">
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-[18px] accent-signal" />
        Rozumiem a súhlasím s týmto spracovaním.
      </label>
    </div>
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

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section aria-labelledby={`${id}-mic`} className="space-y-5">
        <h2 id={`${id}-mic`} className="type-heading text-[1.35rem]">
          Mikrofón a zvuk
        </h2>
        {!micConsentGiven ? (
          <ConsentBlock
            id={`${id}-mic-consent`}
            title={MICROPHONE_CONSENT.title}
            points={MICROPHONE_CONSENT.points}
            checked={micConsent}
            onChange={setMicConsent}
          />
        ) : (
          <p className="text-[14.5px] leading-relaxed text-mute">
            Hlas sa posiela poskytovateľovi AI na prepis a odpovede investora. Nahrávku neukladáme, iba prepis a merania.
          </p>
        )}

        {!micReady ? (
          <button
            type="button"
            className={buttonClasses({ variant: "secondary" })}
            onClick={() => enableMic(rememberedDevice("mic"))}
            disabled={micBusy}
          >
            {micBusy ? <Spinner /> : null}
            Povoliť mikrofón
          </button>
        ) : (
          <div className="space-y-4 rounded-[12px] border border-line-strong p-4">
            {mics.length > 1 ? (
              <Select
                aria-label="Mikrofón"
                value={micId ?? ""}
                onChange={(event) => void enableMic(event.target.value || null)}
              >
                {mics.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Mikrofón ${index + 1}`}
                  </option>
                ))}
              </Select>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14.5px] text-mute">Povedz pár slov a sleduj úroveň</span>
              <LevelMeter level={snapshot.micLevel} />
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t border-line/70 pt-4">
              <button type="button" className={buttonClasses({ variant: "ghost", className: "h-9 px-3 text-sm" })} onClick={() => void playTestTone(snapshot.speakerVolume)}>
                Prehrať skúšobný tón
              </button>
              <label className="flex flex-1 items-center gap-3 text-sm text-mute">
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
            </div>
          </div>
        )}
        {micError ? <Notice tone="error">{micError}</Notice> : null}
        <p className="text-[13px] leading-relaxed text-faint">Odporúčame slúchadlá: investor ťa potom nepočuje vlastným hlasom.</p>
      </section>

      {cameraEnabled ? (
        <section aria-labelledby={`${id}-camera`} className="space-y-5">
          <h2 id={`${id}-camera`} className="type-heading text-[1.35rem]">
            Kamera <span className="text-[1rem] font-normal text-faint">voliteľné</span>
          </h2>
          {useCamera ? (
            <>
              {!cameraConsentGiven ? (
                <ConsentBlock
                  id={`${id}-camera-consent`}
                  title={CAMERA_CONSENT.title}
                  points={CAMERA_CONSENT.points}
                  checked={cameraConsent}
                  onChange={setCameraConsent}
                />
              ) : null}
              {cameraStream ? (
                <div className="space-y-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-[4/3] w-full max-w-[26rem] -scale-x-100 rounded-[12px] border border-line-strong bg-ink-2 object-cover"
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
                  <p className="text-[13px] text-faint">Sadni si tak, aby bola tvár v strede a boli vidieť ramená.</p>
                </div>
              ) : (
                <button type="button" className={buttonClasses({ variant: "secondary" })} onClick={() => void enableCamera(rememberedDevice("camera"))}>
                  Zapnúť kameru
                </button>
              )}
              {cameraError ? <Notice tone="error">{cameraError}</Notice> : null}
              <button
                type="button"
                className="text-sm text-mute underline-offset-4 hover:text-paper hover:underline"
                onClick={() => {
                  cameraStream?.getTracks().forEach((track) => track.stop());
                  setCameraStream(null);
                  onCameraStream(null);
                  setUseCamera(false);
                }}
              >
                Pokračovať bez kamery
              </button>
            </>
          ) : (
            <p className="leading-relaxed text-mute">
              Kamera je vypnutá. Hlasový tréning funguje rovnako, v rozbore iba chýbajú neverbálne signály.
            </p>
          )}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line/70 pt-6 lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-faint">
          {snapshot.error ? <span className="text-coral">{snapshot.error}</span> : preview ? "Ukážka prehrá vzorový rozhovor. Mikrofón a kameru si môžeš vyskúšať naostro." : !micReady ? "Najprv povoľ mikrofón." : !micConsent ? "Potvrď súhlas s hlasovým rozhovorom." : "Všetko je pripravené."}
        </div>
        <button type="button" onClick={start} disabled={!canStart || starting} className={buttonClasses({ size: "lg" })}>
          {starting ? <Spinner /> : null}
          {preview ? "Spustiť ukážku rozhovoru" : "Začať rozhovor"}
        </button>
      </div>
    </div>
  );
}
