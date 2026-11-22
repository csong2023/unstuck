import type { Hold, HoldColor } from "@/data/types";

/**
 * Finds coloured holds in a wall photo, entirely in the browser.
 *
 * Each pixel is classified into a hold colour by hue, saturation and
 * brightness. Connected regions of one colour become holds, and each hold's
 * outline is traced radially from its centre. Works on raw RGBA pixels so
 * it runs on canvas ImageData.
 */

interface Range {
  hue: [number, number];
  sat: [number, number];
  val: [number, number];
}

// Red and pink share hues, so they are found together and each hold is then
// split by its saturation: glossy red highlights and shaded pink would
// otherwise be mislabelled pixel by pixel.
const CLASSES: Record<string, Range[]> = {
  redpink: [
    { hue: [330, 360], sat: [0.3, 1], val: [0.3, 1] },
    { hue: [0, 12], sat: [0.3, 1], val: [0.3, 1] },
  ],
  orange: [{ hue: [12, 40], sat: [0.55, 1], val: [0.55, 1] }],
  yellow: [{ hue: [44, 68], sat: [0.45, 1], val: [0.5, 1] }],
  green: [{ hue: [95, 165], sat: [0.4, 1], val: [0.3, 1] }],
  blue: [{ hue: [195, 235], sat: [0.4, 1], val: [0.45, 1] }],
  purple: [{ hue: [270, 320], sat: [0.35, 1], val: [0.25, 0.8] }],
};

export const HOLD_COLORS: HoldColor[] = ["red", "pink", "orange", "yellow", "green", "blue", "purple"];
const PREFIX: Record<HoldColor, string> = {
  red: "R",
  pink: "P",
  orange: "O",
  yellow: "Y",
  green: "G",
  blue: "B",
  purple: "U",
};

const RED_MIN_SATURATION = 0.8; // 75th percentile of a red/pink blob's saturation
const PINK_MIN_VALUE = 0.85; // median brightness; darker pinkish blobs are skin or shadow
const MIN_AREA = 1.5e-4; // fraction of the image; smaller blobs are labels, screws or noise
const MAX_AREA = 0.03; // larger blobs are painted wall, mats or volumes, not holds
const BACKGROUND_COVERAGE = 0.08; // a colour covering more of the image than this is wall or mats
const OUTLINE_POINTS = 20;

/** Longest side, in pixels, that tracing works at. Larger images are scaled down first. */
export const TRACE_SIZE = 1000;

export function traceHolds(rgba: Uint8ClampedArray, w: number, h: number): Hold[] {
  const n = w * h;
  const hue = new Float32Array(n);
  const sat = new Float32Array(n);
  const val = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4] / 255;
    const g = rgba[i * 4 + 1] / 255;
    const b = rgba[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    let hh = 0;
    if (d > 1e-6) {
      if (mx === r) hh = (((g - b) / d) % 6 + 6) % 6;
      else if (mx === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
    }
    hue[i] = hh * 60;
    sat[i] = mx > 0 ? d / mx : 0;
    val[i] = mx;
  }

  const found: { color: HoldColor; cx: number; cy: number; area: number; pts: [number, number][] }[] = [];
  for (const [cls, ranges] of Object.entries(CLASSES)) {
    let m = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      for (const rg of ranges) {
        if (
          hue[i] >= rg.hue[0] && hue[i] <= rg.hue[1] &&
          sat[i] >= rg.sat[0] && sat[i] <= rg.sat[1] &&
          val[i] >= rg.val[0] && val[i] <= rg.val[1]
        ) {
          m[i] = 1;
          break;
        }
      }
    }
    suppressBackground(m, sat);
    m = dilate(erode(m, w, h), w, h); // opening: drop specks
    for (let k = 0; k < 3; k++) m = dilate(m, w, h); // closing: join a hold's pieces
    for (let k = 0; k < 3; k++) m = erode(m, w, h);
    fillHoles(m, w, h);

    for (const region of components(m, w, h)) {
      if (region.length < MIN_AREA * n || region.length > MAX_AREA * n) continue;
      let color = cls as HoldColor;
      if (cls === "redpink") {
        if (percentile(region, sat, 0.75) >= RED_MIN_SATURATION) color = "red";
        else if (percentile(region, val, 0.5) >= PINK_MIN_VALUE) color = "pink";
        else continue;
      }
      let sx = 0;
      let sy = 0;
      for (const p of region) {
        sx += p % w;
        sy += (p / w) | 0;
      }
      const cx = sx / region.length;
      const cy = sy / region.length;
      found.push({ color, cx, cy, area: region.length, pts: radialOutline(region, w, cx, cy) });
    }
  }

  // Stable order: by colour, then top-to-bottom in rows, then left-to-right.
  const row = Math.max(w, h) * 0.05;
  found.sort(
    (a, b) =>
      HOLD_COLORS.indexOf(a.color) - HOLD_COLORS.indexOf(b.color) ||
      Math.round(a.cy / row) - Math.round(b.cy / row) ||
      a.cx - b.cx,
  );
  const count: Partial<Record<HoldColor, number>> = {};
  const clamp = (t: number) => Math.min(1, Math.max(0, t));
  const r4 = (t: number) => Math.round(t * 10000) / 10000;
  return found.map((f) => {
    const k = (count[f.color] = (count[f.color] ?? 0) + 1);
    return {
      id: `${PREFIX[f.color]}${String(k).padStart(2, "0")}`,
      color: f.color,
      x: r4(f.cx / w),
      y: r4(f.cy / h),
      r: r4(Math.sqrt(f.area / Math.PI) / w),
      outline: f.pts.map(([x, y]) => [r4(clamp(x / w)), r4(clamp(y / h))] as [number, number]),
    };
  });
}

/**
 * When one colour covers much of the photo, it is the painted wall, floor
 * mats or ceiling, not holds. Keep only that colour's most vivid pixels,
 * which is where holds of the same colour stand out from it.
 */
function suppressBackground(m: Uint8Array, sat: Float32Array) {
  let count = 0;
  for (let i = 0; i < m.length; i++) count += m[i];
  if (count < BACKGROUND_COVERAGE * m.length) return;
  const hist = new Uint32Array(101);
  for (let i = 0; i < m.length; i++) if (m[i]) hist[Math.round(sat[i] * 100)]++;
  let seen = 0;
  let cutoff = 100;
  for (let b = 0; b <= 100; b++) {
    seen += hist[b];
    if (seen >= 0.9 * count) {
      cutoff = b / 100 + 0.05;
      break;
    }
  }
  for (let i = 0; i < m.length; i++) if (m[i] && sat[i] < cutoff) m[i] = 0;
}

/** 4-neighbour dilation (outside the image counts as empty). */
function dilate(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      out[i] = m[i] | (x > 0 ? m[i - 1] : 0) | (x < w - 1 ? m[i + 1] : 0) | (y > 0 ? m[i - w] : 0) | (y < h - 1 ? m[i + w] : 0);
    }
  }
  return out;
}

/** 4-neighbour erosion (outside the image counts as empty). */
function erode(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      out[i] = m[i] & m[i - 1] & m[i + 1] & m[i - w] & m[i + w];
    }
  }
  return out;
}

/** Fills enclosed gaps (e.g. a bolt hole or highlight inside a hold). */
function fillHoles(m: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(m.length);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!m[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < m.length - w) push(i + w);
  }
  for (let i = 0; i < m.length; i++) if (!outside[i]) m[i] = 1;
}

/** 4-connected regions of set pixels, as lists of pixel indices. */
function components(m: Uint8Array, w: number, h: number): number[][] {
  const seen = new Uint8Array(m.length);
  const out: number[][] = [];
  for (let start = 0; start < m.length; start++) {
    if (!m[start] || seen[start]) continue;
    const region: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      region.push(i);
      const x = i % w;
      const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1];
      for (const j of next) {
        if (j >= 0 && m[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    out.push(region);
  }
  return out;
}

function percentile(region: number[], values: Float32Array, q: number): number {
  const v = region.map((i) => values[i]).sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(q * (v.length - 1)))];
}

/** Farthest pixel in each angular sector around the centre, lightly smoothed. */
function radialOutline(region: number[], w: number, cx: number, cy: number): [number, number][] {
  const radii = new Array<number>(OUTLINE_POINTS).fill(0);
  for (const i of region) {
    const dx = (i % w) - cx;
    const dy = ((i / w) | 0) - cy;
    const s = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * OUTLINE_POINTS) % OUTLINE_POINTS;
    radii[s] = Math.max(radii[s], Math.hypot(dx, dy));
  }
  const filled = radii.filter((r) => r > 0).sort((a, b) => a - b);
  const median = filled[Math.floor(filled.length / 2)] ?? 1;
  const r0 = radii.map((r) => (r > 0 ? r : median));
  const N = OUTLINE_POINTS;
  return r0.map((_, i) => {
    const r = (r0[(i + N - 1) % N] + 2 * r0[i] + r0[(i + 1) % N]) / 4;
    const a = -Math.PI + ((i + 0.5) * 2 * Math.PI) / N;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}
