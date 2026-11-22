import { LIMBS, type Hold, type HoldColor, type HoldId, type HoldRole, type Limb, type Problem, type Snapshot, type Wall } from "@/data/types";

export const COLOR_SWATCHES: Record<HoldColor, string> = {
  red: "#e3001c",
  pink: "#ff7d95",
  orange: "#f08a24",
  yellow: "#f5d000",
  green: "#00b44a",
  blue: "#1f7fd6",
  purple: "#9b4fd1",
};

/** A problem's holds: every hold on the wall in the problem's colour. */
export function problemHolds(wall: Wall, problem: Problem): Hold[] {
  return wall.holds.filter((h) => h.color === problem.color);
}

export function holdRole(problem: Problem, id: HoldId): HoldRole {
  if (problem.start.includes(id)) return "start";
  if (problem.finish.includes(id)) return "finish";
  return "hold";
}

export const LIMB_LABELS: Record<Limb, string> = {
  leftHand: "Left hand",
  rightHand: "Right hand",
  leftFoot: "Left foot",
  rightFoot: "Right foot",
};

export const LIMB_SHORT: Record<Limb, string> = {
  leftHand: "LH",
  rightHand: "RH",
  leftFoot: "LF",
  rightFoot: "RF",
};

export interface LimbMove {
  limb: Limb;
  from: HoldId | null;
  to: HoldId | null;
}

/** The limbs whose contact changed between two snapshots. */
export function diffSnapshots(prev: Snapshot, next: Snapshot): LimbMove[] {
  return LIMBS.filter((limb) => prev[limb] !== next[limb]).map((limb) => ({
    limb,
    from: prev[limb],
    to: next[limb],
  }));
}

/** The moves that lead into step `index` (empty for the start position). */
export function movesIntoStep(steps: Snapshot[], index: number): LimbMove[] {
  if (index <= 0 || index >= steps.length) return [];
  return diffSnapshots(steps[index - 1], steps[index]);
}

/**
 * Checks the wall data and returns a list of problems (empty when valid).
 * Called at build time from the page, so bad data fails `npm run build`.
 */
export function validateWall(wall: Wall): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const hold of wall.holds) {
    if (ids.has(hold.id)) errors.push(`Duplicate hold id ${hold.id}`);
    ids.add(hold.id);
    if (hold.x < 0 || hold.x > 1 || hold.y < 0 || hold.y > 1) {
      errors.push(`Hold ${hold.id} is outside normalized [0, 1] coordinates`);
    }
  }

  for (const hold of wall.holds) {
    if (hold.outline.length < 3) errors.push(`Hold ${hold.id} outline needs at least 3 points`);
    if (hold.outline.some(([x, y]) => x < 0 || x > 1 || y < 0 || y > 1)) {
      errors.push(`Hold ${hold.id} outline is outside normalized [0, 1] coordinates`);
    }
  }

  const byId = new Map(wall.holds.map((h) => [h.id, h]));
  for (const problem of wall.problems) {
    const onColor = (id: HoldId) => byId.get(id)?.color === problem.color;
    if (problem.start.length === 0) errors.push(`${problem.id} has no start hold`);
    if (problem.finish.length === 0) errors.push(`${problem.id} has no finish hold`);
    for (const id of [...problem.start, ...problem.finish]) {
      if (!byId.has(id)) errors.push(`${problem.id}: unknown hold ${id}`);
      else if (!onColor(id)) errors.push(`${problem.id}: ${id} is not ${problem.color}`);
    }
    if (problem.sequences.length === 0) errors.push(`${problem.id} has no sequences`);

    for (const seq of problem.sequences) {
      const where = `${problem.id}/${seq.id}`;
      if (seq.steps.length === 0) errors.push(`${where} has no steps`);
      seq.steps.forEach((step, i) => {
        for (const limb of LIMBS) {
          const holdId = step[limb];
          if (holdId === null) continue;
          if (!byId.has(holdId)) errors.push(`${where} step ${i}: ${limb} is on unknown hold ${holdId}`);
          else if (!onColor(holdId)) {
            errors.push(`${where} step ${i}: ${limb} is on ${holdId}, which is not ${problem.color}`);
          }
        }
        if (i > 0 && diffSnapshots(seq.steps[i - 1], step).length === 0) {
          errors.push(`${where} step ${i}: no limb moved`);
        }
      });
      const first = seq.steps[0];
      for (const hand of ["leftHand", "rightHand"] as const) {
        const holdId = first?.[hand];
        if (holdId && !problem.start.includes(holdId)) {
          errors.push(`${where}: ${hand} does not start on a start hold`);
        }
      }
    }
  }

  return errors;
}
