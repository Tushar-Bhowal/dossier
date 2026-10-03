"use client";

import type { Photo } from "@dossier/core/resume";

// Passport size, 35 × 45 mm, at 10 px per mm.
const WIDTH = 350;
const HEIGHT = 450;
const MAX_CHARS = 140_000;

// Cropped to passport shape and re-encoded as JPEG small enough for the contract.
export async function resizePhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  if (bitmap.width < WIDTH || bitmap.height < HEIGHT) {
    bitmap.close();
    throw new Error(`This photo is too small to print sharply. Use one at least ${WIDTH} × ${HEIGHT} pixels.`);
  }
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process this image.");

  const scale = Math.max(WIDTH / bitmap.width, HEIGHT / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  // Keep more of the top when trimming height, so a taller photo doesn't lose the head.
  ctx.drawImage(bitmap, (WIDTH - w) / 2, (HEIGHT - h) * 0.2, w, h);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_CHARS) return { dataUrl };
  }
  throw new Error("This photo is too detailed to shrink. Try a different one.");
}
