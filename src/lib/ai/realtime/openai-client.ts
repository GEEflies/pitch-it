"use client";

import { normalizeOpenAiEvent } from "@/lib/ai/realtime/openai-events";
import type {
  ConnectionState,
  RealtimeClientGrant,
  RealtimeConnection,
  RealtimeEvent,
} from "@/lib/ai/realtime/types";

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const DATA_CHANNEL = "oai-events";
const CONNECT_TIMEOUT_MS = 15_000;
/** Ako dlho tolerujeme stav „disconnected“, kým ho vyhlásime za výpadok. */
const DISCONNECT_GRACE_MS = 4_000;

/** Spojenie s OpenAI Realtime cez WebRTC (mikrofón hore, hlas a udalosti dole). */
export class OpenAiRealtimeConnection implements RealtimeConnection {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private sender: RTCRtpSender | null = null;
  private eventListeners = new Set<(event: RealtimeEvent) => void>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUs = false;
  private state: ConnectionState = "closed";

  onEvent(listener: (event: RealtimeEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(state: ConnectionState) {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.stateListeners) listener(state);
  }

  private emit(event: RealtimeEvent) {
    for (const listener of this.eventListeners) listener(event);
  }

  async connect({
    grant,
    microphone,
    output,
  }: {
    grant: RealtimeClientGrant;
    microphone: MediaStreamTrack;
    output: HTMLAudioElement;
  }): Promise<void> {
    this.closedByUs = false;
    this.setState("connecting");

    const pc = new RTCPeerConnection();
    this.pc = pc;

    pc.ontrack = (event) => {
      output.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void output.play().catch(() => {
        // Autoplay zablokovaný: UI ponúkne tlačidlo na spustenie zvuku.
      });
    };

    this.sender = pc.addTrack(microphone, new MediaStream([microphone]));

    const channel = pc.createDataChannel(DATA_CHANNEL);
    this.channel = channel;
    channel.onmessage = (message) => {
      try {
        const raw = JSON.parse(String(message.data)) as Record<string, unknown>;
        const event = normalizeOpenAiEvent(raw);
        if (event) this.emit(event);
      } catch {
        // Poškodená správa: ignorujeme, spojenie pokračuje.
      }
    };
    channel.onclose = () => {
      if (!this.closedByUs) this.setState("lost");
    };

    pc.onconnectionstatechange = () => {
      const current = pc.connectionState;
      if (current === "connected") {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
        this.setState("connected");
      } else if (current === "disconnected") {
        if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = setTimeout(() => {
          if (pc.connectionState !== "connected" && !this.closedByUs) this.setState("lost");
        }, DISCONNECT_GRACE_MS);
      } else if (current === "failed") {
        if (!this.closedByUs) this.setState("lost");
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const response = await fetch(CALLS_URL, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${grant.clientSecret}`,
        "Content-Type": "application/sdp",
      },
      signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
    });
    if (!response.ok) {
      this.close();
      throw new Error(`Realtime spojenie odmietnuté (${response.status}).`);
    }
    await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });

    await new Promise<void>((resolve, reject) => {
      if (channel.readyState === "open") return resolve();
      const timer = setTimeout(() => reject(new Error("Dátový kanál sa neotvoril včas.")), CONNECT_TIMEOUT_MS);
      channel.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      channel.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Dátový kanál zlyhal."));
      });
    });
    this.setState("connected");
  }

  private send(payload: Record<string, unknown>) {
    if (this.channel?.readyState === "open") this.channel.send(JSON.stringify(payload));
  }

  private addSystemNote(note: string) {
    this.send({
      type: "conversation.item.create",
      item: { type: "message", role: "system", content: [{ type: "input_text", text: note }] },
    });
  }

  requestResponse(note: string): void {
    this.addSystemNote(note);
    this.send({ type: "response.create" });
  }

  sendFounderText(text: string): void {
    this.send({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    });
    this.send({ type: "response.create" });
  }

  interruptFounder(note: string): void {
    // Počas prerušenia nesmie reč foundera zrušiť odpoveď investora.
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        audio: { input: { turn_detection: { type: "semantic_vad", create_response: true, interrupt_response: false } } },
      },
    });
    this.send({ type: "input_audio_buffer.commit" });
    this.requestResponse(note);
  }

  /** Po prerušení vráti normálne správanie (founder môže prerušiť investora). */
  restoreBargeIn(eagerness: "low" | "medium" | "high" | "auto"): void {
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        audio: {
          input: { turn_detection: { type: "semantic_vad", eagerness, create_response: true, interrupt_response: true } },
        },
      },
    });
  }

  cancelInvestor(): void {
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
  }

  acknowledgeTool(callId: string, output: string): void {
    this.send({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output },
    });
  }

  setMicrophoneEnabled(enabled: boolean): void {
    const track = this.sender?.track;
    if (track) track.enabled = enabled;
  }

  close(): void {
    this.closedByUs = true;
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    try {
      this.channel?.close();
    } catch {
      // už zatvorené
    }
    this.pc?.getSenders().forEach((sender) => {
      // Mikrofón vlastní relácia, nezastavujeme ho tu; iba odpojíme.
      void sender.replaceTrack(null).catch(() => undefined);
    });
    this.pc?.close();
    this.pc = null;
    this.channel = null;
    this.sender = null;
    this.setState("closed");
  }
}
