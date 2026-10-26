import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Vector3 } from "three";
import type { ResearchAnswer } from "../../shared/types";
import { REGION_BY_ID } from "../../shared/regions";
import { DISEASE_BY_ID } from "../../shared/diseases";
import { personNoun } from "../../shared/lifeStage";
import { api } from "../api";
import { useStore } from "../store";
import { BrainViewer, type BrainScene } from "../components/BrainViewer";
import { AnswerPanel } from "../components/AnswerPanel";
import { DiseasePicker, DiseaseTimeline, stageOverlay } from "../components/DiseasePanel";
import { StudyCardSkeleton } from "../components/StudyCard";
import { CharacterCard } from "../character/CharacterCard";
import { characterQuestion, scenariosForAge } from "../character/scenarios";
import { IconX } from "../icons";

type Mode = "situation" | "disease";

export function Compare() {
  const [params] = useSearchParams();
  const { settings, character } = useStore();
  const name = character.name.trim() || "Leo";
  const [mode, setMode] = useState<Mode>(params.get("d") ? "disease" : "situation");
  const [selected, setSelected] = useState<string | null>(null);

  // ── situation mode ──
  const [answer, setAnswer] = useState<ResearchAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ title: string; q: string; focus?: string } | null>(null);

  // ── disease mode ──
  const [diseaseId, setDiseaseId] = useState<string | undefined>(params.get("d") ?? undefined);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const disease = diseaseId ? DISEASE_BY_ID.get(diseaseId) : undefined;

  const run = useCallback(
    async (title: string, q: string, focus?: string) => {
      setCurrent({ title, q, focus });
      setBusy(true);
      setError(null);
      try {
        setAnswer(
          await api.ask(q, {
            allowPubMed: settings.includePubMedByDefault,
            character: { name, age: character.age },
            includeHormones: character.includeHormones,
            focus,
            sources: settings.sources.length ? settings.sources : undefined,
            allowWeb: settings.webSearch,
          }),
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [settings.includePubMedByDefault, settings.sources, settings.webSearch, name, character.age, character.includeHormones],
  );

  // Arriving from the Brain Lab with ?q=…&f=… compares that question.
  const started = useRef(false);
  useEffect(() => {
    const q = params.get("q");
    if (q && !started.current) {
      started.current = true;
      void run(q.length > 60 ? `${q.slice(0, 57)}…` : q, q, params.get("f") ?? undefined);
    }
  }, [params, run]);

  // ── keep both cameras in sync ──
  const scenes = useRef<{ a: BrainScene | null; b: BrainScene | null }>({ a: null, b: null });
  const follow = (from: "a" | "b") => (p: Vector3, t: Vector3) => scenes.current[from === "a" ? "b" : "a"]?.setCamera(p, t);

  const conditionRegions = mode === "disease" ? Object.keys(stageOverlay(disease, stage) ?? {}) : answer?.regions.map((r) => r.name) ?? [];
  const conditionLabel =
    mode === "disease"
      ? disease
        ? `${disease.name} · ${disease.stages[stage]?.label}`
        : "Choose a disease"
      : current
        ? current.title
        : "Choose a situation";

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="eyebrow">Compare</div>
          <h1>Control vs. condition</h1>
          <p>
            Scientists compare a <strong>control</strong> (the normal, baseline case) with a <strong>condition</strong> (what changes). Here, the control is a typical
            brain and the condition is a situation or disease. Rotate either brain — they move together.
          </p>
        </div>
      </header>

      <div className="lab-top">
        <CharacterCard compact />
        <div className="panel panel-pad stack-sm">
          <div className="row" role="tablist" aria-label="What to compare">
            <button role="tab" className="btn" aria-selected={mode === "situation"} aria-pressed={mode === "situation"} onClick={() => setMode("situation")}>A situation</button>
            <button role="tab" className="btn" aria-selected={mode === "disease"} aria-pressed={mode === "disease"} onClick={() => setMode("disease")}>A long-term disease</button>
          </div>
          {mode === "situation" ? (
            <div className="situation-grid">
              {scenariosForAge(character.age).slice(0, 9).map((s) => (
                <button
                  key={s.id}
                  className="situation"
                  disabled={busy}
                  aria-pressed={current?.title === s.title}
                  onClick={() => run(s.title, characterQuestion(name, character.age, s.situation, character.includeHormones), s.focus)}
                >
                  <span className="situation-title">{s.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <DiseasePicker selected={diseaseId} onSelect={(id) => (setDiseaseId(id), setStage(0), setPlaying(true))} />
          )}
        </div>
      </div>

      <div className="compare-grid">
        <section className="viewer-frame compare-cell">
          <div className="compare-label control">
            <strong>CONTROL</strong> · typical brain, no condition
          </div>
          <BrainViewer
            selected={selected}
            onSelect={setSelected}
            autoRotate={false}
            caption={`Typical ${character.age}-year-old ${personNoun(character.age)} — average brain model`}
            onSceneReady={(s) => (scenes.current.a = s)}
            onCameraChange={follow("a")}
          />
        </section>
        <section className="viewer-frame compare-cell">
          <div className="compare-label condition">
            <strong>CONDITION</strong> · {conditionLabel}
          </div>
          <BrainViewer
            selected={selected}
            onSelect={setSelected}
            autoRotate={false}
            cited={mode === "situation" ? conditionRegions : []}
            overlay={mode === "disease" ? stageOverlay(disease, stage) : null}
            overlayLabel={mode === "disease" && disease ? conditionLabel : undefined}
            caption={mode === "disease" ? "Colors: published staging model (where changes typically appear) — not a scan" : "Violet: regions the cited studies discuss — not an activity map"}
            onSceneReady={(s) => (scenes.current.b = s)}
            onCameraChange={follow("b")}
          />
        </section>
      </div>

      <div className="compare-detail">
        <section className="panel panel-pad">
          <div className="section-label">What's different in the condition brain</div>
          {conditionRegions.length ? (
            <div className="row wrap" style={{ gap: 6 }}>
              {conditionRegions.map((id) => (
                <button key={id} className={`chip ${mode === "disease" ? "amber" : "violet"}`} onClick={() => setSelected(id)}>
                  {REGION_BY_ID.get(id)?.name ?? id}
                </button>
              ))}
            </div>
          ) : (
            <p className="small faint">
              {mode === "disease"
                ? "Pick a disease to see which regions its staging model involves."
                : busy
                  ? "Researching…"
                  : current
                    ? "The cited studies did not report specific brain regions, so nothing is highlighted. That's honest, not a bug — see the answer below."
                    : "Pick a situation to research it."}
            </p>
          )}
          <p className="xs faint" style={{ marginTop: 8 }}>
            Click a region to zoom both brains to it. Both brains use the same average model; differences shown are from research, not from scans of {name}.
          </p>
        </section>

        {mode === "disease" && disease && (
          <section className="panel panel-pad">
            <DiseaseTimeline disease={disease} stage={stage} onStage={setStage} playing={playing} onPlaying={setPlaying} />
          </section>
        )}

        {mode === "situation" && (
          <section className="panel panel-pad">
            {busy && (
              <div className="stack">
                <div className="row small dim"><span className="spinner" /> Researching “{current?.title}” for people {name}'s age…</div>
                <StudyCardSkeleton />
              </div>
            )}
            {!busy && error && (
              <div className="notice red"><IconX size={16} /><span>{error}</span></div>
            )}
            {!busy && !error && answer && <AnswerPanel answer={answer} onSelectRegion={setSelected} />}
            {!busy && !error && !answer && <p className="small faint">The research answer for the condition will appear here.</p>}
          </section>
        )}
      </div>
    </div>
  );
}
