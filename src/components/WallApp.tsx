"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { Credit, Wall } from "@/data/types";
import type { SamplePhoto } from "@/data/samples";
import { wallFromPhoto } from "@/lib/wallFromPhoto";
import { RouteEditor } from "./RouteEditor";

/** A wall photo the user can pick. `wall` is set once its holds are known. */
interface Entry {
  id: string;
  name: string;
  imageUrl: string;
  credit?: Credit;
  uploaded?: boolean;
  wall?: Wall;
}

type Status = { kind: "idle" } | { kind: "tracing"; name: string } | { kind: "error"; message: string };

/** Lets the browser paint the "finding holds" message before tracing blocks it. */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** A problem, sequence and step to show once a wall opens (from a shared link). */
type View = { problem?: string | null; seq?: string | null; step?: string | null };

/** Points the URL at a wall, replacing the old wall's problem, sequence and step. */
function setWallInUrl(id: string, view: View = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set("wall", id);
  for (const key of ["problem", "seq", "step"] as const) {
    const value = view[key];
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

export function WallApp({ initialWall, samples }: { initialWall: Wall; samples: SamplePhoto[] }) {
  const [entries, setEntries] = useState<Entry[]>(() => [
    { id: initialWall.id, name: initialWall.name, imageUrl: initialWall.imageUrl, credit: initialWall.credit, wall: initialWall },
    ...samples.map((s) => ({ ...s })),
  ]);
  const [selectedId, setSelectedId] = useState(initialWall.id);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const uploads = useRef(0);
  const objectUrls = useRef<string[]>([]);

  const selected = entries.find((e) => e.id === selectedId)?.wall ?? initialWall;

  async function open(entry: Entry, view: View = {}) {
    if (status.kind === "tracing") return;
    let wall = entry.wall;
    if (!wall) {
      setStatus({ kind: "tracing", name: entry.name });
      await nextFrame();
      try {
        wall = await wallFromPhoto(entry);
      } catch (err) {
        setStatus({ kind: "error", message: err instanceof Error ? err.message : "Could not read this photo." });
        if (entry.uploaded) setEntries((list) => list.filter((e) => e.id !== entry.id));
        return;
      }
      const ready = wall;
      setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, wall: ready } : e)));
    }
    setWallInUrl(entry.id, view);
    setSelectedId(entry.id);
    setStatus({ kind: "idle" });
  }

  function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ kind: "error", message: `${file.name} is not an image.` });
      return;
    }
    uploads.current += 1;
    const imageUrl = URL.createObjectURL(file);
    objectUrls.current.push(imageUrl);
    const entry: Entry = {
      id: `upload-${uploads.current}`,
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Uploaded photo",
      imageUrl,
      uploaded: true,
    };
    setEntries((list) => [...list, entry]);
    void open(entry);
  }

  // Open the wall named in the URL (uploads only live in memory, so they
  // can't be restored after a reload). Runs once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const entry = entries.find((e) => e.id === params.get("wall"));
    // The default wall's editor rewrites ?problem=, ?seq= and ?step= while
    // this one is traced, so pass the linked view along.
    if (entry && entry.id !== initialWall.id) {
      void open(entry, { problem: params.get("problem"), seq: params.get("seq"), step: params.get("step") });
    }
    const urls = objectUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const picker = (
    <section className="walls" aria-label="Wall photo">
      <div className="walls-head">
        <p className="eyebrow">Wall photo</p>
        <label className={status.kind === "tracing" ? "upload disabled" : "upload"}>
          <input type="file" accept="image/*" onChange={onUpload} disabled={status.kind === "tracing"} />
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 13V3M5.5 7.5 10 3l4.5 4.5M3 13v3h14v-3" />
          </svg>
          Upload photo
        </label>
      </div>
      <ul className="wall-list">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              className={e.id === selectedId ? "active" : undefined}
              aria-pressed={e.id === selectedId}
              disabled={status.kind === "tracing"}
              onClick={() => void open(e)}
              title={e.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- plain thumbnails of local and uploaded photos */}
              <img src={e.imageUrl} alt="" />
              <span>{e.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {status.kind === "tracing" && (
        <p className="status" role="status">
          Finding holds in {status.name}…
        </p>
      )}
      {status.kind === "error" && (
        <p className="status error" role="alert">
          {status.message}
        </p>
      )}
    </section>
  );

  return <RouteEditor key={selected.id} wall={selected} picker={picker} />;
}
