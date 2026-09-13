"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Info, Loader2, X } from "lucide-react";
import { useToasts, toast, type Toast } from "./toast";
import { Button } from "./button";
import { cn } from "@/lib/utils";

function ToastItem({ item }: { item: Toast }) {
  React.useEffect(() => {
    if (!item.duration || item.duration <= 0) return;
    const timer = setTimeout(() => {
      toast.dismiss(item.id);
    }, item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration]);

  const icons = {
    success: <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />,
    error: <AlertCircle className="size-4 text-[#FB4128] shrink-0 mt-0.5" />,
    info: <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />,
    loading: <Loader2 className="size-4 animate-spin text-[#FB4128] shrink-0 mt-0.5" />,
  };

  const borderStyles = {
    success: "border-emerald-500/20 shadow-sm",
    error: "border-[#FB4128]/30 shadow-[0_4px_20px_rgba(251,65,40,0.15)]",
    info: "border-border/80 shadow-sm",
    loading: "border-border/70 shadow-sm",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      role={item.type === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card/95 backdrop-blur-md p-3.5 text-card-foreground shadow-xl transition-all",
        borderStyles[item.type]
      )}
    >
      {item.icon ?? icons[item.type]}

      <div className="flex-1 min-w-0 pr-1">
        <p className="text-xs font-semibold text-foreground tracking-tight line-clamp-2">
          {item.title}
        </p>
        {item.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">
            {item.description}
          </p>
        )}
        {item.action && (
          <Button
            size="xs"
            variant="outline"
            className="mt-2 text-xs rounded-lg h-6 px-2"
            onClick={() => {
              item.action?.onClick();
              toast.dismiss(item.id);
            }}
          >
            {item.action.label}
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => toast.dismiss(item.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-muted-foreground hover:text-foreground rounded-sm p-0.5 transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const toasts = useToasts();

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((item) => (
          <ToastItem key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}
