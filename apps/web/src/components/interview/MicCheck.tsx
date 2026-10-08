"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { interviewScenario } from "@/lib/interview/demo/scenario";
import { cn } from "@/lib/utils";

export type MicState = "idle" | "testing" | "heard" | "blocked" | "missing" | "unsupported";

const MESSAGES: Partial<Record<MicState, string>> = {
  blocked: "Microphone access is blocked. Allow it in your browser's site settings, or answer by typing instead.",
  missing: "We couldn't find a microphone. Plug one in and test again, or answer by typing instead.",
  unsupported: "This browser can't use a microphone here. Answer by typing instead; it works everywhere.",
};

// Listens for a few seconds on this device only; nothing is recorded or sent anywhere.
export function MicCheck({ state, onState }: { state: MicState; onState: (s: MicState) => void }) {
  const [level, setLevel] = React.useState(0);
  const cleanup = React.useRef<(() => void) | null>(null);

  React.useEffect(() => () => cleanup.current?.(), []);

  async function test() {
    cleanup.current?.();
    if (interviewScenario.getScenario().fail === "no_mic") {
      onState("missing");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      onState("unsupported");
      return;
    }
    onState("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      let heard = false;
      const started = performance.now();
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
        setLevel(avg);
        if (avg > 0.04) heard = true;
        if (performance.now() - started > 4000) {
          stop();
          onState(heard ? "heard" : "idle");
          return;
        }
        frame = requestAnimationFrame(tick);
      };
      const stop = () => {
        cancelAnimationFrame(frame);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
        cleanup.current = null;
        setLevel(0);
      };
      cleanup.current = stop;
      frame = requestAnimationFrame(tick);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      onState(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "missing");
    }
  }

  const problem = MESSAGES[state];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-lg",
              state === "heard" ? "bg-emerald-500/15 text-emerald-300" : problem ? "bg-destructive/15 text-[#ff8a70]" : "bg-white/[0.06] text-[#ff7a5c]",
            )}
          >
            {state === "heard" ? <CheckCircle2 className="size-5" aria-hidden /> : problem ? <AlertCircle className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
          </span>
          <div>
            <p className="text-[15px] font-semibold text-white">
              {state === "heard" ? "We can hear you" : state === "testing" ? "Say a few words…" : problem ? "Microphone problem" : "Check your microphone"}
            </p>
            <p className="mt-0.5 text-sm font-medium text-white/55">
              {state === "testing" ? "Listening for 4 seconds. Nothing is recorded." : "Takes a few seconds. Nothing is recorded or sent."}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" className="h-11 shrink-0 sm:h-10" onClick={() => void test()} disabled={state === "testing"}>
          {state === "heard" || problem ? "Test again" : "Test microphone"}
        </Button>
      </div>
      {state === "testing" && (
        <div className="flex h-8 items-end gap-1" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="w-full rounded-full bg-[#ff7a5c] transition-[height] duration-75"
              style={{ height: `${Math.max(8, Math.min(100, level * 400 * (0.6 + ((i * 7) % 5) / 10)))}%` }}
            />
          ))}
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm font-medium leading-relaxed text-[#ff8a70]">
          {problem}
        </p>
      )}
    </div>
  );
}
