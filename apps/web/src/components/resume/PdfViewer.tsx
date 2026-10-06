"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PdfPages } from "./PdfPages";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

// Safari reports trackpad pinches as these instead of ctrl+wheel.
interface GestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

const canPan = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;

export function PdfViewer({
  pdf,
  label,
  zoom,
  onZoomChange,
  className,
}: {
  pdf: Uint8Array;
  label: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const [renderZoom, setRenderZoom] = React.useState(zoom);
  const live = React.useRef(zoom);
  const shown = React.useRef(zoom);
  const anchor = React.useRef<{ x: number; y: number } | null>(null);
  const setZoom = React.useRef(onZoomChange);

  React.useEffect(() => {
    setZoom.current = onZoomChange;
  });

  // Pages are only redrawn once zooming pauses; until then the existing canvases are stretched.
  React.useEffect(() => {
    const t = setTimeout(() => setRenderZoom(zoom), 180);
    return () => clearTimeout(t);
  }, [zoom]);

  // Resize the current pages to the new zoom and keep the point under the pointer (or the middle
  // of the view, for the buttons) where it was.
  React.useLayoutEffect(() => {
    const b = box.current;
    const from = shown.current;
    shown.current = zoom;
    live.current = zoom;
    if (!b || from === zoom) return;

    const canvases = Array.from(b.querySelectorAll("canvas"));
    const first = canvases[0];
    const { x, y } = anchor.current ?? { x: b.clientWidth / 2, y: b.clientHeight / 2 };
    anchor.current = null;
    const before = first ? { left: first.offsetLeft, top: first.offsetTop } : { left: 0, top: 0 };
    const pointX = b.scrollLeft + x - before.left;
    const pointY = b.scrollTop + y - before.top;

    const k = zoom / from;
    for (const c of canvases) {
      c.style.width = `${Math.round(parseFloat(c.style.width) * k)}px`;
      c.style.height = `${Math.round(parseFloat(c.style.height) * k)}px`;
    }

    const after = first ? { left: first.offsetLeft, top: first.offsetTop } : before;
    b.scrollLeft = after.left + pointX * k - x;
    b.scrollTop = after.top + pointY * k - y;
  }, [zoom]);

  React.useEffect(() => {
    const b = box.current;
    if (!b) return;

    const zoomAt = (next: number, clientX: number, clientY: number) => {
      const r = b.getBoundingClientRect();
      anchor.current = { x: clientX - r.left, y: clientY - r.top };
      live.current = clampZoom(next);
      setZoom.current(live.current);
    };

    // Trackpad pinch arrives as ctrl+wheel in Chrome, Edge and Firefox; Ctrl/⌘ + mouse wheel too.
    // A plain wheel or two-finger swipe is left alone and scrolls.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = Math.max(-25, Math.min(25, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
      zoomAt(live.current * Math.exp(-delta * 0.01), e.clientX, e.clientY);
    };

    let gestureStart = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStart = live.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEvent;
      zoomAt(gestureStart * g.scale, g.clientX, g.clientY);
    };

    let pinch: { distance: number; zoom: number } | null = null;
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { distance: distance(e.touches), zoom: live.current };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [a, c] = [e.touches[0], e.touches[1]];
      zoomAt((pinch.zoom * distance(e.touches)) / pinch.distance, (a.clientX + c.clientX) / 2, (a.clientY + c.clientY) / 2);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };

    const active = { passive: false } as const;
    b.addEventListener("wheel", onWheel, active);
    b.addEventListener("gesturestart", onGestureStart, active);
    b.addEventListener("gesturechange", onGestureChange, active);
    b.addEventListener("touchstart", onTouchStart, { passive: true });
    b.addEventListener("touchmove", onTouchMove, active);
    b.addEventListener("touchend", onTouchEnd);
    b.addEventListener("touchcancel", onTouchEnd);
    return () => {
      b.removeEventListener("wheel", onWheel);
      b.removeEventListener("gesturestart", onGestureStart);
      b.removeEventListener("gesturechange", onGestureChange);
      b.removeEventListener("touchstart", onTouchStart);
      b.removeEventListener("touchmove", onTouchMove);
      b.removeEventListener("touchend", onTouchEnd);
      b.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  // Mouse and pen drag the page around like a hand tool; touch already scrolls natively.
  const drag = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget;
    if (e.pointerType === "touch" || e.button !== 0 || !canPan(b)) return;
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, left: b.scrollLeft, top: b.scrollTop };
    b.setPointerCapture(e.pointerId);
    b.dataset.dragging = "true";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget;
    const d = drag.current;
    if (!d) {
      b.dataset.pannable = String(canPan(b));
      return;
    }
    b.scrollLeft = d.left - (e.clientX - d.x);
    b.scrollTop = d.top - (e.clientY - d.y);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    delete e.currentTarget.dataset.dragging;
  };

  return (
    <div
      ref={box}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        "relative touch-pan-x touch-pan-y overflow-auto overscroll-contain select-none data-[pannable=true]:not-data-dragging:cursor-grab data-dragging:cursor-grabbing",
        className,
      )}
    >
      <PdfPages pdf={pdf} label={label} zoom={renderZoom} liveZoom={live} />
    </div>
  );
}
