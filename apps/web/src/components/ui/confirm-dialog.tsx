"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  icon?: React.ReactNode;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description = "This action cannot be undone.",
  confirmLabel = "Delete",
  confirmingLabel,
  cancelLabel = "Cancel",
  variant = "destructive",
  icon,
  onConfirm,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = React.useState(false);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isConfirming) return;

    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const isDestructive = variant === "destructive";
  const defaultConfirming = confirmLabel.toLowerCase().includes("delete")
    ? "Deleting…"
    : "Processing…";
  const activeConfirming = confirmingLabel ?? defaultConfirming;

  return (
    <AlertDialog open={open} onOpenChange={(val) => !isConfirming && onOpenChange(val)}>
      <AlertDialogContent className="rounded-lg border-border/80 bg-background/95 backdrop-blur-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            {icon ? (
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg mt-0.5 border",
                  isDestructive
                    ? "bg-destructive/15 text-destructive border-destructive/20"
                    : "bg-muted text-foreground border-border"
                )}
              >
                {icon}
              </div>
            ) : isDestructive ? (
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive border border-destructive/20 mt-0.5">
                <AlertTriangle className="size-4" />
              </div>
            ) : null}
            <div className="flex flex-col gap-1 text-left">
              <AlertDialogTitle className="text-base font-semibold">{title}</AlertDialogTitle>
              {description && (
                <AlertDialogDescription className="text-xs text-muted-foreground">
                  {description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2 flex items-center gap-2 sm:justify-end">
          <AlertDialogCancel
            disabled={isConfirming}
            className="rounded-lg h-9 px-4 text-xs font-medium"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={isConfirming}
            onClick={handleConfirm}
            className="rounded-lg h-9 px-4 text-xs font-medium gap-1.5"
          >
            {isConfirming && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isConfirming ? activeConfirming : confirmLabel}</span>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
