"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InterviewRecord, InterviewTurn } from "@dossier/core/interview";
import { AlertCircle, Clock, Keyboard, LoaderCircle, Mic, MicOff, SkipForward, Square, UserRound, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { DEMO_UI } from "@/lib/demo/scenario";
import { useDictation } from "@/lib/resume/dictation";
import { finishInterview, interviewKeys } from "@/lib/interview/api";
import { interviewScenario } from "@/lib/interview/demo/scenario";
import { sampleAnswer } from "@/lib/interview/demo/data";
import { interviewerLines, needsFollowUp } from "@/lib/interview/script";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/roadmap/RoadmapView";
import { formatDuration } from "./parts";

type Phase = "ready" | "speaking" | "answering" | "finishing";

function speakingMs(text: string): number {
  return Math.max(1800, Math.round((text.split(/\s+/).length / 2.6) * 1000));
}

export function LiveInterview({ record }: { record: InterviewRecord }) {
  const queryClient = useQueryClient();
  const lines = React.useMemo(() => interviewerLines(record.source.label, record.questions), [record]);
  const [phase, setPhase] = React.useState<Phase>("ready");
  const [mode, setMode] = React.useState(record.mode);
  const [qIndex, setQIndex] = React.useState(0);
  const [line, setLine] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [turns, setTurns] = React.useState<InterviewTurn[]>([]);
  const [elapsed, setElapsed] = React.useState(0);
  const [voiceOn, setVoiceOn] = React.useState(true);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = React.useState(false);

  const t0 = React.useRef(0);
  const turnsRef = React.useRef<InterviewTurn[]>([]);
  const answerStart = React.useRef(0);
  const followedUp = React.useRef(false);
  const switched = React.useRef(false);
  const timer = React.useRef<number | null>(null);
  const transcriptEnd = React.useRef<HTMLDivElement>(null);

  const dictation = useDictation({
    lang: "en-IN",
    onFinalText: (text) => setAnswer((a) => (a ? `${a} ${text}` : text)),
  });
  const voice = mode === "voice";
  const question = record.questions[qIndex];
  const capSec = record.maxMinutes * 60;

  const now = () => Math.round(performance.now() - t0.current);
  const addTurn = (turn: InterviewTurn) => {
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
  };

  const finish = useMutation({
    mutationFn: () => finishInterview(record.id, { turns: turnsRef.current, durationSec: Math.round(now() / 1000), switchedToText: switched.current }),
    onSuccess: (next) => {
      queryClient.setQueryData(interviewKeys.one(record.id), next);
      void queryClient.invalidateQueries({ queryKey: interviewKeys.list });
    },
    onError: () => toast.error("Couldn't send your answers", { description: "They're still here. Try ending again." }),
  });

  const stopListening = dictation.stop;
  const stopAll = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    window.speechSynthesis?.cancel();
    stopListening();
  }, [stopListening]);

  React.useEffect(() => () => stopAll(), [stopAll]);

  const endRef = React.useRef<() => void>(() => {});

  // The session has a hard time limit; at the limit it ends itself and goes to scoring.
  React.useEffect(() => {
    if (phase === "ready" || phase === "finishing") return;
    const tick = window.setInterval(() => {
      const secs = Math.round((performance.now() - t0.current) / 1000);
      setElapsed(secs);
      if (secs >= capSec) {
        window.clearInterval(tick);
        toast.info("Time's up", { description: "The interview ended at its time limit. Here's your report." });
        endRef.current();
      }
    }, 1000);
    return () => window.clearInterval(tick);
  }, [phase, capSec]);

  React.useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns]);

  // Leaving mid-interview loses the answers, so the browser asks first.
  React.useEffect(() => {
    if (phase === "ready" || phase === "finishing") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  function end() {
    stopAll();
    setPhase("finishing");
    finish.mutate();
  }

  React.useEffect(() => {
    endRef.current = end;
  });

  function say(text: string, questionId: string | null, then: () => void) {
    const duration = speakingMs(text);
    const start = now();
    addTurn({ role: "interviewer", questionId, text, startMs: start, endMs: start + duration });
    setLine(text);
    setPhase("speaking");
    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
      then();
    };
    if (voice && voiceOn && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-IN";
      utterance.onend = next;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      timer.current = window.setTimeout(next, duration * 2);
    } else {
      timer.current = window.setTimeout(next, duration);
    }
  }

  function listen() {
    setPhase("answering");
    answerStart.current = now();
    if (voice && dictation.supported) dictation.start();
  }

  function ask(i: number) {
    setQIndex(i);
    say(lines.ask(i), record.questions[i].id, listen);
  }

  function begin() {
    t0.current = performance.now();
    if (voice && !dictation.supported) {
      setMode("text");
      switched.current = true;
      setNotice("This browser can't turn speech into text, so type your answers. The interviewer still asks out loud.");
    }
    say(lines.intro, null, () => ask(0));
  }

  function moveOn() {
    if (qIndex + 1 < record.questions.length) ask(qIndex + 1);
    else say(lines.outro, null, end);
  }

  function submit() {
    const text = answer.trim();
    if (!text) {
      setNotice(voice ? "We didn't catch anything yet. Speak, or type your answer in the box." : "Type an answer first, or skip this question.");
      return;
    }
    dictation.stop();
    setNotice(null);
    addTurn({ role: "candidate", questionId: question.id, text, startMs: answerStart.current, endMs: now() });
    setAnswer("");
    if (voice && interviewScenario.getScenario().fail === "voice_drops" && !switched.current) {
      switched.current = true;
      setMode("text");
      setNotice("The voice connection dropped. Your answers so far are kept; carry on by typing.");
    }
    if (qIndex === 0 && !followedUp.current && needsFollowUp(text)) {
      followedUp.current = true;
      say(lines.followUp, question.id, listen);
      return;
    }
    moveOn();
  }

  function skip() {
    dictation.stop();
    setAnswer("");
    setNotice(null);
    moveOn();
  }

  const answered = turns.filter((t) => t.role === "candidate").length;

  if (phase === "ready") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <BackLink href="/interviews">Mock interviews</BackLink>
        <section className="rounded-lg border border-white/[0.08] bg-[#111111] bg-[radial-gradient(90%_70%_at_50%_0%,rgba(251,65,40,0.12),transparent_60%)] p-6 text-center sm:p-10">
          <span className="mx-auto flex size-16 items-center justify-center rounded-lg bg-white/[0.06] text-[#ff7a5c]">
            {voice ? <Mic className="size-7" aria-hidden /> : <Keyboard className="size-7" aria-hidden />}
          </span>
          <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-white">Ready when you are</h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-white/65">
            {record.source.label}: {record.questions.length} questions, up to {record.maxMinutes} minutes.{" "}
            {voice ? "The interviewer speaks; answer out loud." : "Type your answers."} Pause to think whenever you need to.
          </p>
          <Button size="lg" className="mt-6 h-12 px-6 text-base" onClick={begin}>
            Begin interview
          </Button>
          <p className="mt-4 text-sm font-medium text-white/50">You can end at any time and still get a report on what you answered.</p>
        </section>
      </div>
    );
  }

  const speaking = phase === "speaking";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white/55">{record.source.label}</p>
          <p className="text-lg font-semibold text-white">
            Question {Math.min(qIndex + 1, record.questions.length)} of {record.questions.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 text-sm font-semibold tabular-nums text-white/80" aria-label="Time so far">
            <Clock className="size-4 text-white/50" aria-hidden />
            {formatDuration(elapsed)}
            <span className="text-white/40">/ {record.maxMinutes}:00</span>
          </span>
          {voice && (
            <Button
              variant="ghost"
              size="icon"
              className="size-11 text-white/70"
              aria-pressed={!voiceOn}
              aria-label={voiceOn ? "Mute the interviewer's voice" : "Unmute the interviewer's voice"}
              onClick={() => {
                if (voiceOn) window.speechSynthesis?.cancel();
                setVoiceOn((v) => !v);
              }}
            >
              {voiceOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </Button>
          )}
          <Button variant="outline" className="h-11" onClick={() => setConfirmEnd(true)} disabled={phase === "finishing"}>
            <Square className="size-4" aria-hidden />
            End
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Interview" className="flex min-h-[460px] flex-col rounded-lg border border-white/[0.08] bg-[#111111] p-5 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="relative flex size-14 shrink-0 items-center justify-center">
              {speaking && <span className="absolute inset-0 rounded-lg bg-[#ff7a5c]/25 motion-safe:animate-ping" aria-hidden />}
              <span className={cn("relative flex size-14 items-center justify-center rounded-lg", speaking ? "bg-[#dc3019] text-white" : "bg-white/[0.06] text-white/70")}>
                <UserRound className="size-7" aria-hidden />
              </span>
            </span>
            <div aria-live="polite">
              <p className="text-[15px] font-semibold text-white">Interviewer</p>
              <p className={cn("text-sm font-semibold", speaking ? "text-[#ff7a5c]" : "text-white/55")}>
                {phase === "finishing" ? "Wrapping up…" : speaking ? "Speaking…" : "Waiting for your answer"}
              </p>
            </div>
          </div>

          <p className="mt-6 text-xl font-semibold leading-snug tracking-[-0.01em] text-white sm:text-2xl">{line}</p>
          {question?.from && speaking === false && (
            <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm font-medium text-white/65">From your resume: {question.from}</p>
          )}

          <div className="mt-auto pt-8">
            {notice && (
              <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-medium text-amber-100">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {notice}
              </p>
            )}
            {phase === "answering" && (
              <div className="flex flex-col gap-3">
                {voice && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-white/80" aria-live="polite">
                      {dictation.listening ? (
                        <>
                          <span className="relative flex size-3">
                            <span className="absolute inset-0 rounded-full bg-emerald-400 motion-safe:animate-ping" aria-hidden />
                            <span className="relative size-3 rounded-full bg-emerald-400" />
                          </span>
                          Listening. Answer out loud.
                        </>
                      ) : (
                        <>
                          <MicOff className="size-4 text-white/50" aria-hidden />
                          Not listening
                        </>
                      )}
                    </p>
                    {!dictation.listening && dictation.supported && (
                      <Button variant="ghost" className="h-11 sm:h-9" onClick={() => dictation.start()}>
                        <Mic className="size-4" aria-hidden />
                        Listen again
                      </Button>
                    )}
                  </div>
                )}
                <label htmlFor="answer" className="sr-only">
                  Your answer
                </label>
                <Textarea
                  id="answer"
                  rows={voice ? 3 : 5}
                  value={answer}
                  autoFocus={!voice}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={voice ? "Your words appear here as you speak. You can fix them before moving on." : "Type your answer…"}
                  className="text-[15px] leading-relaxed md:text-[15px]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="lg" className="h-11" onClick={submit}>
                    {voice ? "I'm done answering" : "Send answer"}
                  </Button>
                  <Button variant="ghost" className="h-11" onClick={skip}>
                    <SkipForward className="size-4" aria-hidden />
                    Skip question
                  </Button>
                  {voice && (
                    <Button
                      variant="ghost"
                      className="h-11"
                      onClick={() => {
                        dictation.stop();
                        setMode("text");
                        switched.current = true;
                      }}
                    >
                      <Keyboard className="size-4" aria-hidden />
                      Type instead
                    </Button>
                  )}
                  {DEMO_UI && (
                    <Button
                      variant="ghost"
                      className="h-11 border border-dashed border-white/15 text-white/70"
                      onClick={() => setAnswer(sampleAnswer(interviewScenario.getScenario().persona, question.prompt, qIndex))}
                    >
                      Use a sample answer
                    </Button>
                  )}
                </div>
                {!voice && <p className="text-sm font-medium text-white/45">Ctrl + Enter sends.</p>}
              </div>
            )}
            {phase === "finishing" && (
              <p className="flex items-center gap-2 text-[15px] font-semibold text-white/80" role="status">
                <LoaderCircle className="size-5 animate-spin text-[#ff7a5c] motion-reduce:animate-none" aria-hidden />
                Sending your answers for scoring…
              </p>
            )}
          </div>
        </section>

        <aside aria-label="Transcript" className="flex max-h-[560px] flex-col rounded-lg border border-white/[0.08] bg-[#111111]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[15px] font-semibold text-white">Transcript</h2>
            <span className="text-sm font-medium text-white/50">{answered} answered</span>
          </div>
          <ol className="flex flex-col gap-4 overflow-y-auto p-5">
            {turns.map((t, i) => (
              <li key={i} className={cn("flex flex-col gap-1", t.role === "candidate" && "items-end")}>
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white/45">{t.role === "interviewer" ? "Interviewer" : "You"}</span>
                <p
                  className={cn(
                    "max-w-[92%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
                    t.role === "interviewer" ? "bg-white/[0.05] text-white/80" : "bg-primary/15 text-white",
                  )}
                >
                  {t.text}
                </p>
              </li>
            ))}
            <div ref={transcriptEnd} />
          </ol>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="End the interview now?"
        description={answered ? `You'll get a report on the ${answered} answer${answered === 1 ? "" : "s"} you gave.` : "You haven't answered anything yet, so there won't be a report."}
        confirmLabel="End interview"
        confirmingLabel="Ending…"
        variant="default"
        icon={<Square className="size-4" />}
        onConfirm={() => end()}
      />
    </div>
  );
}
