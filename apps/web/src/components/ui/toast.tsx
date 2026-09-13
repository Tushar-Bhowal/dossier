"use client";

import * as React from "react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastOptions {
  id?: string;
  description?: string;
  icon?: React.ReactNode;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

type ToastListener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const toast = {
  success(title: string, options?: ToastOptions): string {
    return toast.create({ ...options, title, type: "success" });
  },
  error(title: string, options?: ToastOptions): string {
    return toast.create({ ...options, title, type: "error" });
  },
  info(title: string, options?: ToastOptions): string {
    return toast.create({ ...options, title, type: "info" });
  },
  loading(title: string, options?: ToastOptions): string {
    // Default duration 0 (persists until dismissed or updated)
    return toast.create({ duration: 0, ...options, title, type: "loading" });
  },
  create(toastItem: Omit<Toast, "id"> & { id?: string }): string {
    const id = toastItem.id || generateId();
    const newToast: Toast = {
      id,
      duration: toastItem.duration ?? 4000,
      ...toastItem,
    };

    // If toast with this id already exists, update it in-place
    const existingIndex = toasts.findIndex((t) => t.id === id);
    if (existingIndex !== -1) {
      toasts[existingIndex] = newToast;
    } else {
      toasts = [...toasts, newToast];
    }
    notify();
    return id;
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
  clear() {
    toasts = [];
    notify();
  },
};

export function useToasts(): Toast[] {
  const [currentToasts, setCurrentToasts] = React.useState<Toast[]>(toasts);

  React.useEffect(() => {
    listeners.add(setCurrentToasts);
    return () => {
      listeners.delete(setCurrentToasts);
    };
  }, []);

  return currentToasts;
}
