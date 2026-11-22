import type { SVGProps } from "react";
import { LIMBS, type Hold, type HoldRole, type Limb, type Problem, type Snapshot, type Wall } from "@/data/types";
import { LIMB_SHORT, holdRole, problemHolds, type LimbMove } from "@/lib/sequence";

const VIEW_W = 1000;

export const LIMB_COLORS: Record<Limb, string> = {
  leftHand: "#4f8cff",
  rightHand: "#ff5a5f",
  leftFoot: "#2fd3b4",
  rightFoot: "#ffa03a",
};

/** Where each limb's badge sits around a hold, so shared holds stay readable. */
const BADGE_DIR: Record<Limb, [number, number]> = {
  leftHand: [-0.75, -0.75],
  rightHand: [0.75, -0.75],
  leftFoot: [-0.75, 0.75],
  rightFoot: [0.75, 0.75],
};

type Pt = [number, number];

/** Points scaled out from their centroid, so outlines sit just outside the hold. */
function expand(points: Pt[], cx: number, cy: number, by: number): Pt[] {
  return points.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * by, y + (dy / len) * by];
  });
}

/** Closed path with rounded corners (quadratic curves through edge midpoints). */
function roundedPath(points: Pt[]): string {
  const n = points.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[n - 1], points[0]);
  let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const m = mid(points[i], points[(i + 1) % n]);
    d += ` Q${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + "Z";
}

interface Props {
  wall: Wall;
  /** Undefined when no holds were found on the wall. */
  problem?: Problem;
  /** Null when the problem has no recorded beta. */
  snapshot: Snapshot | null;
  moves: LimbMove[];
  showIds: boolean;
}

export function WallView({ wall, problem, snapshot, moves, showIds }: Props) {
  const viewH = VIEW_W / wall.aspectRatio;
  const byId = new Map(wall.holds.map((h) => [h.id, h]));
  const toView = (h: Hold) => ({
    cx: h.x * VIEW_W,
    cy: h.y * viewH,
    r: h.r * VIEW_W,
    pts: h.outline.map(([x, y]) => [x * VIEW_W, y * viewH] as Pt),
  });
  const routeHolds = problem ? problemHolds(wall, problem) : [];
  const movedLimbs = new Set(moves.map((m) => m.limb));
  const destinations = new Set(moves.map((m) => m.to));
  const origins = new Set(moves.map((m) => m.from));

  return (
    <svg className="wall" style={{ aspectRatio: wall.aspectRatio }} viewBox={`0 0 ${VIEW_W} ${viewH}`} role="img" aria-label={problem ? `${problem.name} on ${wall.name}` : wall.name}>
      <defs>
        <clipPath id="route-spotlight">
          {routeHolds.map((h) => {
            const v = toView(h);
            return <path key={h.id} d={roundedPath(expand(v.pts, v.cx, v.cy, 10))} />;
          })}
        </clipPath>
        <filter id="outline-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.7" />
        </filter>
        {LIMBS.map((limb) => (
          <marker key={limb} id={`arrow-${limb}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0 0L10 5L0 10z" fill={LIMB_COLORS[limb]} />
          </marker>
        ))}
      </defs>

      {/* Photo, dimmed everywhere except the problem's holds */}
      <image href={wall.imageUrl} width={VIEW_W} height={viewH} preserveAspectRatio="none" />
      <rect width={VIEW_W} height={viewH} fill="#0b0d12" opacity="0.58" />
      <image href={wall.imageUrl} width={VIEW_W} height={viewH} preserveAspectRatio="none" clipPath="url(#route-spotlight)" />

      {/* Route outlines, styled by role */}
      <g filter="url(#outline-glow)" fill="none" stroke="#fff" strokeLinejoin="round" strokeLinecap="round">
        {routeHolds.map((h) => (
          <HoldOutline key={h.id} hold={h} role={problem ? holdRole(problem, h.id) : "hold"} toView={toView} active={destinations.has(h.id)} />
        ))}
      </g>

      {/* Where the moving limb came from */}
      {routeHolds
        .filter((h) => origins.has(h.id))
        .map((h) => {
          const v = toView(h);
          return (
            <path
              key={`from-${h.id}`}
              d={roundedPath(expand(v.pts, v.cx, v.cy, 22))}
              fill="none"
              stroke="#fff"
              strokeOpacity="0.7"
              strokeWidth="3"
              strokeDasharray="6 8"
            />
          );
        })}

      {/* Movement arrows */}
      {moves.map((m) => {
        const from = m.from ? byId.get(m.from) : undefined;
        const to = m.to ? byId.get(m.to) : undefined;
        if (!from || !to) return null;
        const a = toView(from);
        const b = toView(to);
        const len = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1;
        const ux = (b.cx - a.cx) / len;
        const uy = (b.cy - a.cy) / len;
        // Bow the arrow slightly so it reads as a movement, not a hold connection.
        const mx = (a.cx + b.cx) / 2 - uy * len * 0.12;
        const my = (a.cy + b.cy) / 2 + ux * len * 0.12;
        const x1 = a.cx + ux * (a.r + 22);
        const y1 = a.cy + uy * (a.r + 22);
        const x2 = b.cx - ux * (b.r + 30);
        const y2 = b.cy - uy * (b.r + 30);
        return (
          <path
            key={m.limb}
            data-move={m.limb}
            className="move-arrow"
            d={`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`}
            fill="none"
            stroke={LIMB_COLORS[m.limb]}
            strokeWidth="7"
            strokeLinecap="round"
            markerEnd={`url(#arrow-${m.limb})`}
          />
        );
      })}

      {/* Hold IDs */}
      {showIds &&
        routeHolds.map((h) => {
          const v = toView(h);
          return (
            <text
              key={`id-${h.id}`}
              x={v.cx}
              // Above the hold, or below it when that would leave the image.
              y={v.cy - v.r - 26 > 24 ? v.cy - v.r - 26 : v.cy + v.r + 44}
              textAnchor="middle"
              className="hold-id"
            >
              {h.id}
            </text>
          );
        })}

      {/* Limb badges on current contacts */}
      {LIMBS.map((limb) => {
        const holdId = snapshot?.[limb];
        const hold = holdId ? byId.get(holdId) : undefined;
        if (!hold) return null;
        const v = toView(hold);
        const [dx, dy] = BADGE_DIR[limb];
        const bx = v.cx + dx * (v.r + 30);
        const by = v.cy + dy * (v.r + 30);
        const moved = movedLimbs.has(limb);
        return (
          <g key={limb} data-contact={limb} data-on={hold.id} className={moved ? "badge moved" : "badge"}>
            <circle cx={bx} cy={by} r={moved ? 25 : 21} fill={LIMB_COLORS[limb]} stroke={moved ? "#fff" : "#0b0d12"} strokeWidth={moved ? 5 : 3} />
            <text x={bx} y={by + 7} textAnchor="middle" className="badge-label">
              {LIMB_SHORT[limb]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HoldOutline({
  hold,
  role,
  toView,
  active,
}: {
  hold: Hold;
  role: HoldRole;
  toView: (h: Hold) => { cx: number; cy: number; r: number; pts: Pt[] };
  active: boolean;
}) {
  const v = toView(hold);
  const width = role === "hold" ? 3.5 : 4.5;
  const ring = (by: number, extra?: SVGProps<SVGPathElement>) => (
    <path d={roundedPath(expand(v.pts, v.cx, v.cy, by))} strokeWidth={width} {...extra} />
  );
  return (
    <g data-hold={hold.id} data-role={role} className={active ? "outline active" : "outline"}>
      {ring(8)}
      {role === "finish" && ring(22)}
      {role === "start" && (
        // Two tick marks under the hold, like tape on a gym start hold.
        <>
          <line x1={v.cx - 10} y1={v.cy + v.r + 18} x2={v.cx - 18} y2={v.cy + v.r + 48} strokeWidth={width} />
          <line x1={v.cx + 10} y1={v.cy + v.r + 18} x2={v.cx + 18} y2={v.cy + v.r + 48} strokeWidth={width} />
        </>
      )}
    </g>
  );
}
