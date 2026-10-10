import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { normalizeOpenAiEvent } from "../src/lib/ai/realtime/openai-events.ts";
import type { RealtimeEvent } from "../src/lib/ai/realtime/types.ts";
import {
  initialLiveState,
  liveReducer,
  MAX_RECONNECT_ATTEMPTS,
  stateWithHistory,
  turnsReadyToPersist,
  type LiveState,
} from "../src/lib/session/live-state.ts";

function run(state: LiveState, events: Array<[RealtimeEvent, number]>): LiveState {
  return events.reduce((current, [event, at]) => liveReducer(current, { type: "realtime", event, at }), state);
}

function connected(): LiveState {
  return liveReducer(liveReducer(initialLiveState(), { type: "connect_requested" }), { type: "connected" });
}

describe("liveReducer: priebeh rozhovoru", () => {
  test("investor hovorí, founder odpovie, ťahy sa uzavrú v poradí", () => {
    const state = run(connected(), [
      [{ type: "investor_response_started", responseId: "r1" }, 100],
      [{ type: "investor_transcript_delta", itemId: "i1", responseId: "r1", delta: "Koľko máte " }, 200],
      [{ type: "investor_audio_started", responseId: "r1" }, 250],
      [{ type: "investor_transcript_delta", itemId: "i1", responseId: "r1", delta: "zákazníkov?" }, 300],
      [{ type: "investor_transcript_final", itemId: "i1", text: "Koľko máte zákazníkov?" }, 900],
      [{ type: "investor_response_done", responseId: "r1", status: "completed", usage: null }, 950],
      [{ type: "investor_audio_stopped", responseId: "r1", cleared: false }, 2_000],
    ]);
    assert.equal(state.phase, "listening");
    assert.equal(state.turns[0].text, "Koľko máte zákazníkov?");
    assert.equal(state.turns[0].endedMs, 2_000);
    assert.equal(state.lastInvestorEndMs, 2_000);

    const after = run(state, [
      [{ type: "founder_speech_started", itemId: "f1" }, 3_000],
      [{ type: "founder_speech_stopped", itemId: "f1" }, 9_000],
      [{ type: "founder_transcript_final", itemId: "f1", text: "  Štyridsaťosem platiacich.  ", logprobs: null }, 9_500],
    ]);
    assert.equal(after.phase, "processing");
    assert.equal(after.turns[1].speaker, "founder");
    assert.equal(after.turns[1].text, "Štyridsaťosem platiacich.");
    assert.equal(after.turns[1].seq, 1);
    assert.deepEqual(turnsReadyToPersist(after, () => false).map((turn) => turn.seq), [0, 1]);
    assert.deepEqual(turnsReadyToPersist(after, (seq) => seq === 0).map((turn) => turn.seq), [1]);
  });

  test("prerušenie investora: zrušená odpoveď sa označí ako prerušená", () => {
    const state = run(connected(), [
      [{ type: "investor_response_started", responseId: "r1" }, 0],
      [{ type: "investor_transcript_delta", itemId: "i1", responseId: "r1", delta: "Povedzte mi viac o" }, 100],
      [{ type: "investor_audio_started", responseId: "r1" }, 150],
      [{ type: "founder_speech_started", itemId: "f1" }, 800],
      [{ type: "investor_audio_stopped", responseId: "r1", cleared: true }, 820],
      [{ type: "investor_response_done", responseId: "r1", status: "cancelled", usage: null }, 830],
    ]);
    assert.equal(state.turns[0].interrupted, true);
    assert.equal(state.turns[0].final, true);
    assert.equal(state.phase, "founder_speaking");
  });

  test("nepodarený prepis sa uzavrie ako failed", () => {
    const state = run(connected(), [
      [{ type: "founder_speech_started", itemId: "f1" }, 0],
      [{ type: "founder_transcript_failed", itemId: "f1" }, 500],
    ]);
    assert.equal(state.turns[0].failed, true);
    assert.equal(turnsReadyToPersist(state, () => false).length, 1);
  });
});

describe("liveReducer: výpadok a obnova", () => {
  test("výpadok uzavrie rozpracované ťahy a po troch pokusoch skončí ako failed", () => {
    let state = run(connected(), [[{ type: "founder_speech_started", itemId: "f1" }, 0]]);
    state = liveReducer(state, { type: "connection_lost" });
    assert.equal(state.status, "reconnecting");
    assert.equal(state.turns[0].final, true);
    assert.equal(state.turns[0].interrupted, true);
    assert.equal(state.founderItemId, null);

    state = liveReducer(state, { type: "connected" });
    assert.equal(state.status, "live");
    assert.equal(state.reconnectAttempts, 0);

    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i += 1) state = liveReducer(state, { type: "connection_lost" });
    assert.equal(state.status, "reconnecting");
    state = liveReducer(state, { type: "connection_lost" });
    assert.equal(state.status, "failed");
    assert.ok(state.error);
  });

  test("po ukončení sa udalosti ignorujú a výpadok nemení stav", () => {
    let state = liveReducer(connected(), { type: "ended" });
    state = liveReducer(state, { type: "connection_lost" });
    assert.equal(state.status, "ended");
    const same = run(state, [[{ type: "founder_speech_started", itemId: "x" }, 0]]);
    assert.equal(same, state);
  });

  test("textové ťahy používajú seq zo servera a nadväzujú na históriu", () => {
    let state = stateWithHistory([
      { seq: 0, speaker: "investor", itemId: null, responseId: null, text: "Otázka", final: true, interrupted: false, failed: false, startedMs: 0, endedMs: 0, source: "realtime" },
    ]);
    assert.equal(state.nextSeq, 1);
    state = liveReducer(state, { type: "text_turn", speaker: "founder", text: "Odpoveď", at: 10, seq: 1 });
    state = liveReducer(state, { type: "text_turn", speaker: "investor", text: "Ďalšia", at: 20, seq: 2 });
    state = liveReducer(state, { type: "text_turn", speaker: "investor", text: "Ďalšia", at: 20, seq: 2 });
    assert.deepEqual(state.turns.map((turn) => turn.seq), [0, 1, 2]);
    assert.equal(state.nextSeq, 3);
    assert.equal(state.phase, "listening");
  });
});

describe("normalizeOpenAiEvent", () => {
  test("GA aj beta názvy prepisu investora", () => {
    assert.deepEqual(normalizeOpenAiEvent({ type: "response.output_audio_transcript.delta", item_id: "i", response_id: "r", delta: "A" }), {
      type: "investor_transcript_delta",
      itemId: "i",
      responseId: "r",
      delta: "A",
    });
    assert.equal(normalizeOpenAiEvent({ type: "response.audio_transcript.done", item_id: "i", transcript: "B" })?.type, "investor_transcript_final");
  });

  test("response.done s usage", () => {
    const event = normalizeOpenAiEvent({
      type: "response.done",
      response: {
        id: "r1",
        status: "completed",
        usage: { input_tokens: 10, output_tokens: 20, input_token_details: { audio_tokens: 4, cached_tokens: 2 }, output_token_details: { audio_tokens: 15 } },
      },
    });
    assert.deepEqual(event, {
      type: "investor_response_done",
      responseId: "r1",
      status: "completed",
      usage: { inputTokens: 10, outputTokens: 20, inputAudioTokens: 4, outputAudioTokens: 15, cachedTokens: 2 },
    });
  });

  test("prepis foundera s logprobs, neznáme a neúplné udalosti", () => {
    const final = normalizeOpenAiEvent({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "f1",
      transcript: "Ahoj",
      logprobs: [{ token: "A", logprob: -0.1 }],
    });
    assert.deepEqual(final, { type: "founder_transcript_final", itemId: "f1", text: "Ahoj", logprobs: [{ logprob: -0.1 }] });
    assert.equal(normalizeOpenAiEvent({ type: "rate_limits.updated" }), null);
    assert.equal(normalizeOpenAiEvent({ type: "input_audio_buffer.speech_started" }), null);
    assert.equal(normalizeOpenAiEvent({ type: "output_audio_buffer.cleared" })?.type, "investor_audio_stopped");
  });
});
