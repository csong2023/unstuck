"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LIMBS, type Limb, type Wall } from "@/data/types";
import { COLOR_SWATCHES, LIMB_LABELS, LIMB_SHORT, holdRole, movesIntoStep, problemHolds } from "@/lib/sequence";
import { LIMB_COLORS, WallView } from "./WallView";

/** Contacts laid out like a body: hands on top, feet below. */
const BODY_GRID: Limb[] = ["leftHand", "rightHand", "leftFoot", "rightFoot"];

export function RouteEditor({ wall, picker }: { wall: Wall; picker?: ReactNode }) {
  const [problemId, setProblemId] = useState(wall.problems[0]?.id);
  const [seqId, setSeqId] = useState(wall.problems[0]?.sequences[0]?.id);
  const [stepIndex, setStepIndex] = useState(0);
  const [showIds, setShowIds] = useState(true);

  const problem = wall.problems.find((p) => p.id === problemId) ?? wall.problems[0];
  const sequence = problem?.sequences.find((s) => s.id === seqId) ?? problem?.sequences[0];
  const steps = sequence?.steps ?? [];
  const lastIndex = Math.max(0, steps.length - 1);
  // Keep the step number when switching sequences, so the same step can be
  // compared across sequences; clamp it to the new sequence's length.
  const index = Math.min(stepIndex, lastIndex);
  const snapshot = steps[index] ?? null;
  const moves = sequence ? movesIntoStep(steps, index) : [];

  const selectProblem = (id: string) => {
    const next = wall.problems.find((p) => p.id === id);
    if (!next || next.id === problem?.id) return;
    setProblemId(next.id);
    setSeqId(next.sequences[0]?.id);
    setStepIndex(0);
  };

  // Restore ?problem=…&seq=…&step=… on load, and keep the URL in sync so a
  // view can be shared. The URL is only written after it has been read, so
  // the first write can't clobber the link the page was opened with.
  const [urlRestored, setUrlRestored] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restored = wall.problems.find((p) => p.id === params.get("problem")) ?? wall.problems[0];
    const seq = restored?.sequences.find((s) => s.id === params.get("seq")) ?? restored?.sequences[0];
    const step = Number(params.get("step"));
    setProblemId(restored?.id);
    setSeqId(seq?.id);
    if (Number.isInteger(step) && step > 0) setStepIndex(step);
    setUrlRestored(true);
  }, [wall]);

  useEffect(() => {
    if (!urlRestored) return;
    const url = new URL(window.location.href);
    if (problem) url.searchParams.set("problem", problem.id);
    else url.searchParams.delete("problem");
    if (sequence) {
      url.searchParams.set("seq", sequence.id);
      url.searchParams.set("step", String(index));
    } else {
      url.searchParams.delete("seq");
      url.searchParams.delete("step");
    }
    window.history.replaceState(null, "", url);
  }, [urlRestored, problem, sequence, index]);

  const back = useCallback(() => setStepIndex((i) => Math.max(0, Math.min(i, lastIndex) - 1)), [lastIndex]);
  const forward = useCallback(() => setStepIndex((i) => Math.min(lastIndex, i + 1)), [lastIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft") back();
      if (e.key === "ArrowRight") forward();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, forward]);

  const holdCount = problem ? problemHolds(wall, problem).length : 0;

  return (
    <div className="editor">
      <section className="stage">
        <WallView wall={wall} problem={problem} snapshot={snapshot} moves={moves} showIds={showIds} />
      </section>

      <aside className="panel">
        {picker}

        <header className="problem">
          <div>
            <p className="eyebrow">{wall.name}</p>
            <h1>{problem ? problem.name : "No holds found"}</h1>
          </div>
          {problem?.grade && <span className="grade">{problem.grade}</span>}
        </header>

        {!problem && (
          <p className="rule">
            No coloured holds were found in this photo. Try a brighter, straight-on photo where the holds fill more of
            the frame.
          </p>
        )}

        {problem && (
          <>
            <div className="problems" role="radiogroup" aria-label="Problem colour">
              {wall.problems.map((p) => (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={p.id === problem.id}
                  className={p.id === problem.id ? "active" : undefined}
                  onClick={() => selectProblem(p.id)}
                >
                  <span className="swatch" style={{ background: COLOR_SWATCHES[p.color] }} />
                  {p.name}
                  <span className="problem-grade">{p.grade ?? problemHolds(wall, p).length}</span>
                </button>
              ))}
            </div>
            <p className="rule">
              Stay on <strong style={{ color: COLOR_SWATCHES[problem.color] }}>{problem.color}</strong>: hands and
              feet use only {problem.color} holds
              {problem.start.length > 0
                ? ", from the taped start to the double-ringed finish."
                : `. ${holdCount} found in this photo.`}
            </p>
            {problem.generated && (
              <p className="rule generated">
                Holds were found automatically and the start, finish and beta were worked out from where they are — a
                suggested way up, not the setter&apos;s. {holdCount} {problem.color} holds in this photo.
              </p>
            )}
          </>
        )}

        {problem && sequence && (
          <>
            <div className="segmented" role="tablist" aria-label="Sequence">
              {problem.sequences.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.id === sequence.id}
                  className={s.id === sequence.id ? "active" : undefined}
                  onClick={() => setSeqId(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="move-card" data-testid="move-summary" aria-live="polite">
              <p className="eyebrow">
                Step <span data-testid="step-counter">{index} of {lastIndex}</span>
              </p>
              {moves.length === 0 ? (
                <p className="move-title">Start position</p>
              ) : (
                moves.map((m) => (
                  <div key={m.limb}>
                    <p className="move-title">
                      <span className="limb-chip" style={{ background: LIMB_COLORS[m.limb] }}>
                        {LIMB_SHORT[m.limb]}
                      </span>
                      {LIMB_LABELS[m.limb]} → {m.to ?? "off"}
                    </p>
                    <p className="move-from">
                      from {m.from ?? "off the wall"}
                      {m.to && holdRole(problem, m.to) !== "hold" ? ` · ${m.to} is the ${holdRole(problem, m.to)} hold` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="stepper">
              <button onClick={back} disabled={index === 0} aria-label="Previous step">
                ←
              </button>
              <ol className="timeline" aria-label="Steps">
                {steps.map((_, i) => {
                  const into = movesIntoStep(steps, i);
                  const limb = into[0]?.limb;
                  return (
                    <li key={i}>
                      <button
                        className={i === index ? "current" : i < index ? "done" : undefined}
                        style={limb ? { borderColor: LIMB_COLORS[limb] } : undefined}
                        onClick={() => setStepIndex(i)}
                        aria-label={limb ? `Step ${i}: ${LIMB_LABELS[limb]} to ${into[0].to}` : "Step 0: start"}
                        aria-current={i === index ? "step" : undefined}
                      >
                        {limb ? LIMB_SHORT[limb] : "S"}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button onClick={forward} disabled={index === lastIndex} aria-label="Next step">
                →
              </button>
            </div>

            <div className="contacts" aria-label="Contacts at this step">
              {BODY_GRID.map((limb) => {
                const moved = moves.some((m) => m.limb === limb);
                return (
                  <div key={limb} className={moved ? "contact moved" : "contact"}>
                    <span className="limb-chip" style={{ background: LIMB_COLORS[limb] }}>
                      {LIMB_SHORT[limb]}
                    </span>
                    <span className="contact-label">{LIMB_LABELS[limb]}</span>
                    <span className="contact-hold" data-testid={`contact-${limb}`}>
                      {snapshot?.[limb] ?? "off"}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {problem && !sequence && (
          <div className="move-card empty">
            <p className="eyebrow">No beta yet</p>
            <p className="move-from">
              Too few {problem.color} holds were found to work out a way up. Some may be missing: try a brighter,
              straight-on photo.
            </p>
          </div>
        )}

        <details className="legend">
          <summary>Legend</summary>
          <ul>
            <li>
              <svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="15" rx="12" ry="9" /><line x1="16" y1="28" x2="13" y2="37" /><line x1="24" y1="28" x2="27" y2="37" /></svg>
              Start hold
            </li>
            <li>
              <svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="20" rx="12" ry="9" /></svg>
              Problem hold
            </li>
            <li>
              <svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="20" rx="9" ry="7" /><ellipse cx="20" cy="20" rx="16" ry="13" /></svg>
              Finish hold
            </li>
            {LIMBS.map((limb) => (
              <li key={limb}>
                <span className="limb-chip" style={{ background: LIMB_COLORS[limb] }}>
                  {LIMB_SHORT[limb]}
                </span>
                {LIMB_LABELS[limb]}
              </li>
            ))}
          </ul>
        </details>

        <label className="toggle">
          <input type="checkbox" checked={showIds} onChange={(e) => setShowIds(e.target.checked)} />
          Show hold IDs
        </label>

        <footer className="hint">
          {sequence && <p>← → keys step through the sequence.</p>}
          {wall.credit && (
            <p className="credit">
              Photo:{" "}
              <a href={wall.credit.sourceUrl} target="_blank" rel="noreferrer">
                {wall.credit.author}
              </a>
              ,{" "}
              {wall.credit.licenseUrl ? (
                <a href={wall.credit.licenseUrl} target="_blank" rel="noreferrer">
                  {wall.credit.license}
                </a>
              ) : (
                wall.credit.license
              )}
            </p>
          )}
        </footer>
      </aside>
    </div>
  );
}
