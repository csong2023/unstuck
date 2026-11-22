import type { Hold, HoldId, Limb, Problem, Sequence, Snapshot } from "@/data/types";

/**
 * Generates start, finish and beta for a problem found by tracing a photo.
 *
 * Nothing here knows how the problem was set: it only sees where the holds
 * of one colour are. The start is a low hold with something under it to
 * stand on, the finish is the highest hold, and the hands climb between
 * them along the path of most comfortable moves. Feet follow below the
 * hands. It is a plausible way up, not the setter's intended beta.
 *
 * Distances are measured in units of image width, with y scaled by the
 * aspect ratio so that a move up and a move across of the same length count
 * the same.
 */

interface Pt {
  id: HoldId;
  x: number;
  y: number;
}

/** Reach, in hold radii: a comfortable move is roughly this many radii long. */
const REACH_IN_RADII = 7;

export function autoBeta(holds: Hold[], aspectRatio: number, allHolds: Hold[]): Pick<Problem, "start" | "finish" | "sequences"> {
  const pts: Pt[] = holds.map((h) => ({ id: h.id, x: h.x, y: h.y / aspectRatio }));
  if (pts.length < 2) return { start: [], finish: [], sequences: [] };

  const reach = estimateReach(pts, allHolds);
  const finish = pts.reduce((a, b) => (b.y < a.y ? b : a));
  const start = pickStart(pts, finish, reach);

  // Two styles: shorter, steadier moves and fewer, bigger ones. When they
  // find the same hand path only one is kept.
  const sequences: Sequence[] = [];
  const seen = new Set<string>();
  for (const style of [
    { id: "steady", name: "Steady", moveCost: 1, maxMove: 2.2 },
    { id: "big", name: "Big moves", moveCost: 3, maxMove: 2.6 },
  ]) {
    const path = handPath(pts, start, finish, reach, style.moveCost, style.maxMove);
    const key = path.map((p) => p.id).join(">");
    if (path.length < 2 || seen.has(key)) continue;
    seen.add(key);
    sequences.push({ id: style.id, name: style.name, steps: buildSteps(path, pts, reach) });
  }

  return { start: [start.id], finish: [finish.id], sequences };
}

/** A comfortable move length, from typical hold size and the problem's height. */
function estimateReach(pts: Pt[], allHolds: Hold[]): number {
  const radii = allHolds.map((h) => h.r).sort((a, b) => a - b);
  const medianR = radii[Math.floor(radii.length / 2)] ?? 0.02;
  const span = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
  const fromSize = REACH_IN_RADII * medianR;
  // Keep at least a few moves on a tall problem, and no fewer than two on a
  // short one, whatever the hold sizes suggest.
  return clamp(fromSize, Math.max(0.03, span / 10), Math.max(0.05, span / 2));
}

/**
 * The start hold: the lowest hold in the bottom part of the problem that has
 * another hold of the colour under it to stand on, or the lowest hold if
 * none does (the feet may be out of frame).
 */
function pickStart(pts: Pt[], finish: Pt, reach: number): Pt {
  const bottom = Math.max(...pts.map((p) => p.y));
  const span = bottom - finish.y;
  const low = pts.filter((p) => p !== finish && p.y >= bottom - 0.45 * span).sort((a, b) => b.y - a.y);
  const supported = low.find((p) =>
    pts.some((f) => f !== p && f.y - p.y >= 0.5 * reach && f.y - p.y <= 2.2 * reach && Math.abs(f.x - p.x) <= 1.5 * reach),
  );
  return supported ?? low[0] ?? pts.reduce((a, b) => (b.y > a.y ? b : a));
}

/**
 * The cheapest chain of hand holds from start to finish. Each move costs
 * (length / reach)² + moveCost, which is cheapest per distance gained when a
 * move is √moveCost reaches long. Moves may not drop much, nor go far below
 * the start.
 */
function handPath(pts: Pt[], start: Pt, finish: Pt, reach: number, moveCost: number, maxMove: number): Pt[] {
  const usable = pts.filter((p) => p.y <= start.y + 0.3 * reach);
  const run = (limit: number) => {
    const dist = new Map<Pt, number>(usable.map((p) => [p, Infinity]));
    const prev = new Map<Pt, Pt>();
    const open = new Set(usable);
    dist.set(start, 0);
    while (open.size) {
      let u: Pt | undefined;
      for (const p of open) if (!u || dist.get(p)! < dist.get(u)!) u = p;
      if (!u || dist.get(u) === Infinity || u === finish) break;
      open.delete(u);
      for (const v of open) {
        const d = Math.hypot(v.x - u.x, v.y - u.y) / reach;
        const drop = (v.y - u.y) / reach;
        if (d > limit || drop > 0.3) continue;
        const cost = d * d + moveCost + Math.max(0, drop) * 4;
        const alt = dist.get(u)! + cost;
        if (alt < dist.get(v)!) {
          dist.set(v, alt);
          prev.set(v, u);
        }
      }
    }
    if (dist.get(finish) === Infinity) return null;
    const path = [finish];
    while (path[0] !== start) path.unshift(prev.get(path[0])!);
    return path;
  };
  // Holds the tracer missed can leave gaps; then allow any move length.
  return run(maxMove) ?? run(Infinity) ?? [start, finish];
}

/** Turns a chain of hand holds into full-body snapshots, feet included. */
function buildSteps(path: Pt[], pts: Pt[], reach: number): Snapshot[] {
  const byId = new Map(pts.map((p) => [p.id, p]));
  const at = (id: HoldId | null) => (id ? byId.get(id) ?? null : null);
  const start = path[0];
  const steps: Snapshot[] = [];
  let cur: Snapshot = { leftHand: start.id, rightHand: start.id, leftFoot: null, rightFoot: null };
  cur.leftFoot = footFor("leftFoot", cur, pts, at, reach, false);
  cur.rightFoot = footFor("rightFoot", cur, pts, at, reach, false);
  steps.push(cur);

  const push = (change: Partial<Snapshot>) => {
    const next = { ...cur, ...change };
    if ((Object.keys(change) as Limb[]).some((k) => next[k] !== cur[k])) {
      steps.push(next);
      cur = next;
    }
  };

  let lead: "leftHand" | "rightHand" | null = null; // the hand that moved last
  for (const target of path.slice(1)) {
    let hand: "leftHand" | "rightHand";
    if (cur.leftHand === cur.rightHand) {
      // Matched: reach with the hand on the side the next hold is on.
      hand = target.x >= at(cur.leftHand)!.x ? "rightHand" : "leftHand";
    } else {
      hand = lead === "leftHand" ? "rightHand" : "leftHand";
    }
    push({ [hand]: target.id });
    lead = hand;

    // Bring the feet up when the body is stretched out, lower foot first.
    const order: ("leftFoot" | "rightFoot")[] =
      (at(cur.leftFoot)?.y ?? Infinity) >= (at(cur.rightFoot)?.y ?? Infinity)
        ? ["leftFoot", "rightFoot"]
        : ["rightFoot", "leftFoot"];
    for (const foot of order) {
      const next = footFor(foot, cur, pts, at, reach, true);
      if (next) push({ [foot]: next });
    }
  }

  // Match the finish.
  const finish = path[path.length - 1];
  push({ leftHand: finish.id, rightHand: finish.id });
  return steps;
}

/**
 * The best hold for a foot below the current hands, or null. With `onlyUp`,
 * returns a hold only if it is a worthwhile step up from where the foot is.
 */
function footFor(
  foot: "leftFoot" | "rightFoot",
  s: Snapshot,
  pts: Pt[],
  at: (id: HoldId | null) => Pt | null,
  reach: number,
  onlyUp: boolean,
): HoldId | null {
  const lh = at(s.leftHand)!;
  const rh = at(s.rightHand)!;
  const lowHand = Math.max(lh.y, rh.y);
  const centre = (lh.x + rh.x) / 2;
  const side = foot === "leftFoot" ? -1 : 1;
  const other = s[foot === "leftFoot" ? "rightFoot" : "leftFoot"];
  const current = at(s[foot]);

  if (onlyUp && current && current.y - lowHand < 1.6 * reach) return null; // not stretched yet

  let best: Pt | null = null;
  let bestScore = Infinity;
  for (const p of pts) {
    const below = p.y - lowHand;
    if (below < 0.6 * reach || below > 2.2 * reach) continue;
    if (Math.abs(p.x - centre) > 1.3 * reach) continue;
    if (p.id === s.leftHand || p.id === s.rightHand) continue;
    if (onlyUp && current && p.y > current.y - 0.25 * reach) continue;
    const score =
      Math.abs(below - 1.3 * reach) +
      0.5 * Math.abs(p.x - (centre + side * 0.35 * reach)) +
      (p.id === other ? 0.3 * reach : 0);
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best?.id ?? null;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
