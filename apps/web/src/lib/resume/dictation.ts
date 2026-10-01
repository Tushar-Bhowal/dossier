"use client";

import * as React from "react";

// Minimal shape of the Web Speech API — it isn't in TypeScript's DOM lib.
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionCtor = new () => Recognition;

export const DICTATION_LANGUAGES = [
  { code: "en-IN", label: "English", short: "EN" },
  { code: "hi-IN", label: "हिन्दी (Hindi)", short: "हि" },
  { code: "bn-IN", label: "বাংলা (Bengali)", short: "বা" },
  { code: "mr-IN", label: "मराठी (Marathi)", short: "म" },
  { code: "ta-IN", label: "தமிழ் (Tamil)", short: "த" },
  { code: "te-IN", label: "తెలుగు (Telugu)", short: "తె" },
] as const;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictation({
  lang,
  onFinalText,
  forceUnsupported = false,
}: {
  lang: string;
  onFinalText: (text: string) => void;
  forceUnsupported?: boolean;
}) {
  const supported = !forceUnsupported && getRecognitionCtor() !== null;
  const [listening, setListening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const recognition = React.useRef<Recognition | null>(null);
  const onFinal = React.useRef(onFinalText);

  React.useEffect(() => {
    onFinal.current = onFinalText;
  }, [onFinalText]);

  React.useEffect(() => () => recognition.current?.stop(), []);

  const stop = React.useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || forceUnsupported) return;
    recognition.current?.stop();

    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal) onFinal.current(result[0].transcript.trim());
      }
    };
    r.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow it in your browser, or type instead."
          : "Dictation stopped. You can try again or type instead.",
      );
    };
    r.onend = () => setListening(false);

    setError(null);
    recognition.current = r;
    r.start();
    setListening(true);
  }, [lang, forceUnsupported]);

  return { supported, listening, error, start, stop };
}
