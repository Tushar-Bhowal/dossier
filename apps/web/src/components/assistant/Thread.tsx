"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, LoaderCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantMessage, AssistantText, UserMessage } from "@/components/resume/chat/Thread";
import { PartView } from "./cards";
import type { Assistant } from "./useAssistant";

export function Thread({ assistant }: { assistant: Assistant }) {
  const { messages, busy, step, failure } = assistant;
  const end = React.useRef<HTMLDivElement>(null);
  const last = messages.at(-1);

  React.useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, busy, failure]);

  const announcement = busy ? `${step ?? "Working"}…` : failure ? failure.message : last?.role === "assistant" ? last.text : "";

  return (
    <div className="flex flex-col gap-6">
      {messages.map((message, i) =>
        message.role === "user" ? (
          <UserMessage key={message.id} text={message.text} fileName={message.attachmentLabel} />
        ) : (
          <AssistantMessage key={message.id} avatar={messages[i - 1]?.role !== "assistant"}>
            {message.text && <AssistantText>{message.text}</AssistantText>}
            {message.parts.length > 0 && (
              <div className="flex flex-col gap-2">
                {message.parts.map((part, j) => (
                  <PartView key={j} part={part} messageId={message.id} assistant={assistant} />
                ))}
              </div>
            )}
          </AssistantMessage>
        ),
      )}

      {busy && (
        <AssistantMessage>
          <p className="flex items-center gap-2 pt-0.5 text-[15px] font-medium text-white/60">
            <LoaderCircle className="size-4 animate-spin text-[#ff7a5c]" aria-hidden />
            {step ?? "Working"}…
          </p>
        </AssistantMessage>
      )}

      {failure && !busy && (
        <AssistantMessage avatar={last?.role !== "assistant"}>
          <div className="flex flex-col gap-3 rounded-lg border border-red-400/20 bg-red-500/[0.05] p-4">
            <p className="flex items-start gap-2 text-[15px] font-medium text-red-100">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {failure.message}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => {
                  assistant.dismissFailure();
                  void assistant.send(failure.text, failure.attachment);
                }}
              >
                <RefreshCcw className="size-3.5" aria-hidden /> Try again
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/applications">Do it by hand</Link>
              </Button>
            </div>
          </div>
        </AssistantMessage>
      )}

      <div ref={end} />
      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>
    </div>
  );
}
