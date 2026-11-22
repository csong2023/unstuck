import type { Hold, Snapshot, Wall } from "./types";
import gymHolds from "./gym-holds.json";

/**
 * A real gym wall photo. Holds were traced by colour once and are kept in
 * gym-holds.json, which is now the source of truth: its IDs are used by the
 * beta below, so edit it by hand rather than re-tracing.
 *
 * The problems and sequences are demo beta written for this photo, not the
 * gym's own set problems. The photo is cropped, so the real start and top
 * may be out of frame.
 */

/** Builds a sequence from a start position and one change per step. */
function steps(start: Snapshot, ...moves: Partial<Snapshot>[]): Snapshot[] {
  const out = [start];
  for (const move of moves) out.push({ ...out[out.length - 1], ...move });
  return out;
}

const redStart: Snapshot = { leftHand: "R06", rightHand: "R06", leftFoot: "R09", rightFoot: "R09" };

/** Red: the two sequences differ only in where the right foot goes first. */
function redSequence(rightFoot: string): Snapshot[] {
  return steps(
    redStart,
    { rightFoot },
    { rightHand: "R04" },
    { leftHand: "R03" },
    { leftFoot: "R06" },
    { rightHand: "R02" },
    { leftHand: "R01" },
  );
}

export const gymWall: Wall = {
  id: "gym-wall",
  name: "Gym wall",
  imageUrl: "/walls/gym-wall.jpg",
  credit: {
    author: "the-edit.co.kr",
    license: "Not openly licensed — local testing only",
    sourceUrl: "https://the-edit.co.kr",
  },
  aspectRatio: 1000 / 1250,
  holds: gymHolds as Hold[],
  problems: [
    {
      id: "red",
      name: "Red problem",
      grade: "V3",
      color: "red",
      start: ["R06"],
      finish: ["R01"],
      sequences: [
        { id: "red-a", name: "Big foot", steps: redSequence("R08") },
        { id: "red-b", name: "High chip", steps: redSequence("R07") },
      ],
    },
    {
      id: "green",
      name: "Green problem",
      grade: "V2",
      color: "green",
      start: ["G08"],
      finish: ["G01"],
      sequences: [
        {
          id: "green-a",
          name: "Left line",
          steps: steps(
            { leftHand: "G08", rightHand: "G08", leftFoot: "G10", rightFoot: "G10" },
            { rightHand: "G03" },
            { rightFoot: "G08" },
            { leftHand: "G02" },
            { leftFoot: "G08", rightFoot: "G05" },
            { rightHand: "G01" },
          ),
        },
      ],
    },
  ],
};
