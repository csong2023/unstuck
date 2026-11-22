import type { Credit, Problem, Wall } from "@/data/types";
import { autoBeta } from "./autoBeta";
import { HOLD_COLORS, TRACE_SIZE, traceHolds } from "./traceHolds";

/** Fewer holds of one colour than this is probably stray detections, not a problem. */
const MIN_PROBLEM_HOLDS = 3;

const NAMES: Record<string, string> = {
  red: "Red",
  pink: "Pink",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("This image could not be opened. Try a JPEG or PNG."));
    img.src = url;
  });
}

/**
 * Loads a photo, traces its holds in the browser, and builds a wall with one
 * problem per hold colour, each with a generated start, finish and beta.
 */
export async function wallFromPhoto(opts: { id: string; name: string; imageUrl: string; credit?: Credit }): Promise<Wall> {
  const img = await loadImage(opts.imageUrl);
  const scale = Math.min(1, TRACE_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser can't read image pixels.");
  ctx.drawImage(img, 0, 0, w, h);
  const holds = traceHolds(ctx.getImageData(0, 0, w, h).data, w, h);

  const aspectRatio = w / h;
  const problems: Problem[] = HOLD_COLORS.map((color) => ({ color, own: holds.filter((hd) => hd.color === color) }))
    .filter(({ own }) => own.length >= MIN_PROBLEM_HOLDS)
    .map(({ color, own }) => ({
      id: color,
      name: NAMES[color],
      color,
      generated: true,
      ...autoBeta(own, aspectRatio, holds),
    }));

  return { ...opts, aspectRatio, holds, problems };
}
