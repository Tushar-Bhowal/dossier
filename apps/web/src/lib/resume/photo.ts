"use client";

import type { Photo } from "@dossier/core/resume";

const WIDTH = 300;
const HEIGHT = 372;
const MAX_CHARS = 140_000;

// Centre-cropped to a passport-style ratio and re-encoded as JPEG small enough for the contract.
export async function resizePhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process this image.");

  const scale = Math.max(WIDTH / bitmap.width, HEIGHT / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_CHARS) return { dataUrl };
  }
  throw new Error("This photo is too detailed to shrink. Try a different one.");
}
