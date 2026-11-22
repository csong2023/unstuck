/**
 * Core data model for the route editor.
 *
 * All coordinates are normalized to the wall image: x and y are in [0, 1],
 * measured from the image's top-left corner, so they stay valid at any
 * display size. They are tied to one photo: a new photo of the wall means
 * re-tracing the holds.
 */

/** Stable, human-readable hold ID, e.g. "R04". Never reuse or renumber. */
export type HoldId = string;

/**
 * Hold colour. In a gym, a problem is all the holds of one colour: the
 * climber may only use that colour, hands and feet, from start to finish.
 */
export type HoldColor = "red" | "pink" | "orange" | "yellow" | "green" | "blue" | "purple";

export interface Hold {
  id: HoldId;
  /** Normalized center x in [0, 1], left to right. */
  x: number;
  /** Normalized center y in [0, 1], top to bottom. */
  y: number;
  /** Approximate radius as a fraction of the image width. */
  r: number;
  color: HoldColor;
  /** Traced hold shape: normalized [x, y] points, in order around the hold. */
  outline: [number, number][];
}

/** How a hold is marked in its problem; drives how its outline is drawn. */
export type HoldRole = "start" | "finish" | "hold";

export const LIMBS = ["leftHand", "rightHand", "leftFoot", "rightFoot"] as const;
export type Limb = (typeof LIMBS)[number];

/**
 * The full body position at one step: which hold each limb is on.
 * `null` means the limb is off the wall (e.g. a flagged foot).
 */
export type Snapshot = Record<Limb, HoldId | null>;

/** One way to climb a problem (a "beta"). */
export interface Sequence {
  id: string;
  name: string;
  /** steps[0] is the start position; each later step is a full snapshot. */
  steps: Snapshot[];
}

/**
 * A set problem: every hold of its colour on the wall. Start holds (taped
 * in the gym) and the finish hold are marked; any of its holds may be used
 * by hands or feet.
 */
export interface Problem {
  id: string;
  name: string;
  /** Unknown for problems found by tracing a photo. */
  grade?: string;
  color: HoldColor;
  start: HoldId[];
  finish: HoldId[];
  sequences: Sequence[];
  /** Start, finish and beta were generated from hold positions, not set by hand. */
  generated?: boolean;
}

/** Who took a photo and under what licence. */
export interface Credit {
  author: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
}

export interface Wall {
  id: string;
  name: string;
  imageUrl: string;
  credit?: Credit;
  /** Image width / height, so the SVG keeps the photo's proportions. */
  aspectRatio: number;
  holds: Hold[];
  problems: Problem[];
}
