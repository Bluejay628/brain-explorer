import { useEffect } from "react";
import { useNav } from "../nav";
import { DISEASES, DISEASE_BY_ID, type DiseaseModel } from "../../shared/diseases";
import { IconPause, IconPlay } from "../icons";

/** Overlay values for the brain: region id → 0–1, for one stage of a model. */
export function stageOverlay(d: DiseaseModel | undefined, stage: number): Record<string, number> | null {
  return d ? d.stages[Math.min(stage, d.stages.length - 1)]?.regions ?? null : null;
}

interface TimelineProps {
  disease: DiseaseModel;
  stage: number;
  onStage: (n: number) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
  onAsk?: (q: string) => void;
  compact?: boolean;
}

/** Stage slider + play button. While playing, advances one stage every ~1.8 s and stops at the end. */
export function DiseaseTimeline({ disease, stage, onStage, playing, onPlaying, onAsk, compact = false }: TimelineProps) {
  const last = disease.stages.length - 1;
  const { searchStudies } = useNav();
  useEffect(() => {
    if (!playing) return;
    if (stage >= last) {
      onPlaying(false);
      return;
    }
    const t = setTimeout(() => onStage(stage + 1), 1800);
    return () => clearTimeout(t);
  }, [playing, stage, last, onStage, onPlaying]);

  const s = disease.stages[stage];
  return (
    <div className="stack-sm disease">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow">{disease.modelName}</div>
          <h3 style={{ fontSize: 17, marginTop: 2 }}>{disease.name}</h3>
          <p className="xs faint">Tracks {disease.tracks}.</p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            if (!playing && stage >= last) onStage(0);
            onPlaying(!playing);
          }}
          aria-label={playing ? "Pause animation" : "Play animation"}
        >
          {playing ? <IconPause size={15} /> : <IconPlay size={15} />} {playing ? "Pause" : stage >= last ? "Replay" : "Play"}
        </button>
      </div>

      <div className="stage-track" role="group" aria-label="Disease stage">
        {disease.stages.map((st, i) => (
          <button key={st.label} className="stage-step" aria-pressed={i === stage} data-done={i < stage} onClick={() => (onPlaying(false), onStage(i))}>
            {st.label.replace(/^(Stage|Grade) /, "")}
          </button>
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={last}
        value={stage}
        onChange={(e) => (onPlaying(false), onStage(Number(e.target.value)))}
        className="age-slider"
        aria-label="Stage"
      />
      <div className="row xs faint" style={{ justifyContent: "space-between" }}>
        <span>Earlier</span>
        <span className="legend-ramp" aria-hidden="true" />
        <span>Later / more involved</span>
      </div>

      <div className="panel panel-pad" style={{ padding: "10px 12px" }}>
        <strong className="small">{s.label}</strong>
        <p className="small dim" style={{ marginTop: 2 }}>{s.description}</p>
      </div>

      {!compact && (
        <>
          <p className="xs dim"><strong>Time:</strong> {disease.timeCourse} <strong>Who:</strong> {disease.whoItAffects}</p>
          <div className="notice amber xs"><span>{disease.caution}</span></div>
          <div className="row wrap">
            <button className="btn sm" onClick={() => searchStudies(disease.sourceQuery)}>Find the original paper · {disease.sourceLabel}</button>
            {onAsk && <button className="btn sm ghost" onClick={() => onAsk(disease.question)}>Ask what research says</button>}
          </div>
        </>
      )}
    </div>
  );
}

/** List of disease models to choose from. */
export function DiseasePicker({ selected, onSelect }: { selected?: string; onSelect: (id: string) => void }) {
  return (
    <div className="stack-sm">
      <p className="small dim">Choose a long-term brain disease to watch how it typically spreads, stage by stage, on the 3D brain.</p>
      <div className="situation-grid">
        {DISEASES.map((d) => (
          <button key={d.id} className="situation" aria-pressed={selected === d.id} onClick={() => onSelect(d.id)}>
            <span className="situation-title">{d.name}</span>
            <span className="xs faint">{d.stages.length} stages · {d.sourceLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { DISEASE_BY_ID };
