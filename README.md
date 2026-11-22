# Unstuck

A 2D bouldering route editor. Open a photo of a climbing wall, and Unstuck finds the coloured holds, groups them into one problem per colour, and suggests beta: a start, a finish and a step-by-step sequence of hand and foot moves.

Everything runs in the browser. Photos are never uploaded to a server.

## Features

- **Hold detection.** Holds are found by classifying pixels by hue, saturation and brightness, then tracing each connected region's outline ([src/lib/traceHolds.ts](src/lib/traceHolds.ts)).
- **One problem per colour.** As in a gym, a problem is every hold of one colour ([src/lib/wallFromPhoto.ts](src/lib/wallFromPhoto.ts)).
- **Auto beta.** A plausible way up: a low start hold with a foothold below it, the highest hold as the finish, and hand moves along the most comfortable path, with feet following below ([src/lib/autoBeta.ts](src/lib/autoBeta.ts)). It is a suggestion, not the setter's intended beta.
- **Step-through sequences.** Move through each step with the timeline or the ← / → keys, and see which hold each limb is on.
- **Shareable links.** The URL records the wall, problem, sequence and step (`?wall=…&problem=…&seq=…&step=…`).
- **Your own photos.** Upload a JPEG or PNG of any wall, or try the sample walls.

## Getting started

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command         | What it does                 |
| --------------- | ---------------------------- |
| `npm run dev`   | Start the dev server         |
| `npm run build` | Build for production         |
| `npm start`     | Serve the production build   |

## Project layout

```
src/
  app/          Next.js App Router pages, layout and global styles
  components/   WallApp (wall picker, uploads), RouteEditor, WallView
  lib/          Hold tracing, auto beta and sequence helpers
  data/         Data model types, the built-in gym wall and sample photos
public/walls/   Wall photos
```

Hold coordinates are normalized to the image (x and y in [0, 1] from the top-left), so they stay correct at any display size. See [src/data/types.ts](src/data/types.ts) for the full data model.

## Built with

Next.js 16, React 19 and TypeScript. There are no other runtime dependencies.

## Photo credits

The sample walls in `public/walls/samples/` are from Wikimedia Commons under CC BY-SA 4.0. Authors and sources are listed in [src/data/samples.ts](src/data/samples.ts) and are shown in the app.

`public/walls/gym-wall.jpg` is from the-edit.co.kr. It is **not openly licensed** and is included for local testing only.
