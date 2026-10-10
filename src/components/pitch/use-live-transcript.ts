"use client";

import { useEffect, useRef, useState } from "react";

/*
  Živý prepis počas nahrávania cez Web Speech API prehliadača (Chrome, Edge, Safari).
  Slúži len na titulky a odškrtávanie bodov pitchu; presný prepis robí server po nahrávaní.
*/

type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative; length: number };
type RecognitionEvent = { resultIndex: number; results: { length: number; [i: number]: Result } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function createRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export type LiveTranscript = {
  /** false, ak prehliadač živý prepis nevie */
  supported: boolean;
  /** potvrdený text od začiatku */
  final: string;
  /** rozpracovaná veta */
  interim: string;
};

export function useLiveTranscript(running: boolean, lang = "sk-SK"): LiveTranscript {
  const [supported, setSupported] = useState(true);
  const [final, setFinal] = useState("");
  const [interim, setInterim] = useState("");
  const runningRef = useRef(running);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const rec = createRecognition();
    if (!rec) {
      setSupported(false); // eslint-disable-line react-hooks/set-state-in-effect -- podpora sa dá zistiť len na klientovi
      return;
    }
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let done = "";
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) done += `${r[0].transcript} `;
        else pending += r[0].transcript;
      }
      if (done) setFinal((prev) => `${prev}${done}`);
      setInterim(pending);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "language-not-supported") setSupported(false);
    };
    // prehliadač rozpoznávanie po chvíli ticha ukončí, tak ho znova spustíme
    rec.onend = () => {
      if (!runningRef.current) return;
      try {
        rec.start();
      } catch {
        // už beží
      }
    };
    try {
      rec.start();
    } catch {
      setSupported(false);
    }
    return () => {
      rec.onend = null;
      rec.abort();
      setInterim("");
    };
  }, [running, lang]);

  return { supported, final, interim };
}
