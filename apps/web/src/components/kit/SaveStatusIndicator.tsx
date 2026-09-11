"use client";

import { AnimatePresence, motion } from "motion/react";
import type { SaveStatus } from "@/lib/optimistic";

const LABEL: Record<SaveStatus, string> = {
  saving: "Saving…",
  saved: "Saved",
  retry: "Couldn't save — retrying",
};

const CLASS: Record<SaveStatus, string> = {
  saving: "text-muted-foreground",
  saved: "text-emerald-400",
  retry: "text-destructive",
};

export function SaveStatusIndicator({ status }: { status?: SaveStatus }) {
  return (
    <div className="h-4 text-xs" aria-live="polite">
      <AnimatePresence mode="wait">
        {status ? (
          <motion.span
            key={status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={CLASS[status]}
          >
            {LABEL[status]}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
