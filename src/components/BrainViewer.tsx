import { useEffect, useRef, useState } from "react";
import { BrainScene, webglAvailable, type Appearance, type Part } from "../brain/scene";
export type { BrainScene };
import { REGION_BY_ID, TOP_LEVEL } from "../../shared/regions";
import { IconLayers, IconPause, IconPlay, IconReset, IconRotateL, IconRotateR, IconZoomIn, IconZoomOut } from "../icons";

interface Props {
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  cited?: string[];
  pinned?: string[];
  autoRotate?: boolean;
  compact?: boolean; // hero mode: fewer controls
  showRegionList?: boolean;
  caption?: string;
  /** Disease-stage coloring: region id → 0–1. */
  overlay?: Record<string, number> | null;
  /** Short label shown over the brain while an overlay is active. */
  overlayLabel?: string;
  /** Fly to a region when it is selected (default true). */
  focusOnSelect?: boolean;
  /** Gives the parent access to the scene (e.g. to sync two brains). */
  onSceneReady?: (scene: BrainScene | null) => void;
  onCameraChange?: (position: import("three").Vector3, target: import("three").Vector3) => void;
}

const PARTS: { id: Part; label: string }[] = [
  { id: "left", label: "Left hemisphere" },
  { id: "right", label: "Right hemisphere" },
  { id: "cerebellum", label: "Cerebellum" },
  { id: "brainstem", label: "Brainstem" },
  { id: "deep", label: "Deep structures (see-through cortex)" },
  { id: "glands", label: "Hormone glands (approx. markers)" },
];

const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function BrainViewer({
  selected = null,
  onSelect,
  cited = [],
  pinned = [],
  autoRotate = true,
  compact = false,
  showRegionList = false,
  caption,
  overlay = null,
  overlayLabel,
  focusOnSelect = true,
  onSceneReady,
  onCameraChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BrainScene | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCameraRef = useRef(onCameraChange);
  onCameraRef.current = onCameraChange;
  const [supported] = useState(() => webglAvailable());
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [spinning, setSpinning] = useState(autoRotate && !reducedMotion);
  const [appearance, setAppearance] = useState<Appearance>("tissue");
  const [lines, setLines] = useState(false);
  const [atlasColors, setAtlasColors] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [visible, setVisible] = useState<Record<Part, boolean>>({ left: true, right: true, cerebellum: true, brainstem: true, deep: false, glands: false });

  useEffect(() => {
    if (!supported || !hostRef.current) return;
    let scene: BrainScene;
    try {
      scene = new BrainScene(hostRef.current, {
        autoRotate: autoRotate && !reducedMotion,
        focusOnSelect,
        onSelect: (id) => onSelectRef.current?.(id),
        onCameraChange: (p, t) => onCameraRef.current?.(p, t),
        onHover: (id, x, y) => {
          const tip = tipRef.current;
          if (!tip) return;
          if (!id) {
            tip.style.display = "none";
            return;
          }
          const r = REGION_BY_ID.get(id);
          const parent = r?.parent ? REGION_BY_ID.get(r.parent)?.name : undefined;
          tip.style.display = "block";
          tip.style.left = `${x}px`;
          tip.style.top = `${y}px`;
          tip.textContent = parent ? `${r?.name} · ${parent}` : r?.name ?? id;
        },
      });
    } catch {
      setStatus("error");
      return;
    }
    sceneRef.current = scene;
    onSceneReady?.(scene);
    scene.ready.then(() => setStatus("ready")).catch(() => setStatus("error"));
    return () => {
      onSceneReady?.(null);
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const s = () => sceneRef.current;
  useEffect(() => {
    s()?.setSelected(selected);
    if (s()) setVisible(s()!.getVisible());
    if (selected) setSpinning(false);
  }, [selected, status]);
  useEffect(() => s()?.setCited(cited), [cited.join(","), status]);
  useEffect(() => s()?.setPinned(pinned), [pinned.join(","), status]);
  useEffect(() => s()?.setAutoRotate(spinning), [spinning]);
  useEffect(() => s()?.setOverlay(overlay), [JSON.stringify(overlay), status]);
  useEffect(() => {
    if (overlay) setSpinning(false);
  }, [Boolean(overlay)]);
  useEffect(() => s()?.setAppearance(appearance), [appearance, status]);
  useEffect(() => s()?.setBoundaries(lines), [lines, status]);
  useEffect(() => s()?.setColorAtlas(atlasColors), [atlasColors, status]);

  const togglePart = (p: Part) => {
    const next = { ...visible, [p]: !visible[p] };
    setVisible(next);
    s()?.setVisible(p, next[p]);
  };

  return (
    <div className="stack-sm" style={{ height: "100%" }}>
      <div className="viewer" style={{ flex: 1 }}>
        <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
        {status === "loading" && supported && (
          <div className="fallback"><div className="row small dim"><span className="spinner" /> Loading brain model…</div></div>
        )}
        {(!supported || status === "error") && (
          <div className="fallback">
            <div>
              <p>3D view unavailable{!supported ? " — your browser or device doesn't support WebGL" : " — the brain model could not be loaded"}.</p>
              <p className="small faint" style={{ marginTop: 6 }}>You can still select regions from the list below.</p>
            </div>
          </div>
        )}
        <div ref={tipRef} className="tooltip" style={{ display: "none" }} />
        {overlay && overlayLabel && (
          <div className="overlay-legend">
            <div>
              <span className="row" style={{ gap: 8 }}>
                <strong>{overlayLabel}</strong>
                <span className="legend-ramp" style={{ minWidth: 80 }} aria-hidden="true" />
              </span>
              <span className="xs faint">Published staging model — where changes typically appear, not a scan or measurement.</span>
            </div>
          </div>
        )}

        <div className="hud top">
          <span className="model-label">
            {caption ?? "Average adult brain (FreeSurfer fsaverage) · Desikan-Killiany atlas · shows where regions are, not brain activity"}
          </span>
          {!compact && (
            <div className="controls" role="toolbar" aria-label="Brain view controls">
              <button className="btn sm icon ghost" onClick={() => s()?.rotate(-30)} aria-label="Rotate left" title="Rotate left"><IconRotateL size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => s()?.rotate(30)} aria-label="Rotate right" title="Rotate right"><IconRotateR size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => s()?.zoom(0.85)} aria-label="Zoom in" title="Zoom in"><IconZoomIn size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => s()?.zoom(1.18)} aria-label="Zoom out" title="Zoom out"><IconZoomOut size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => s()?.reset()} aria-label="Reset view" title="Reset view"><IconReset size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => setSpinning((v) => !v)} aria-pressed={spinning} aria-label="Auto-rotate" title="Auto-rotate">
                {spinning ? <IconPause size={17} /> : <IconPlay size={17} />}
              </button>
            </div>
          )}
        </div>

        {!compact && (
          <div className="hud bottom">
            <div className="controls wrap" style={{ position: "relative" }}>
              <button className="btn sm ghost" aria-expanded={layersOpen} onClick={() => setLayersOpen((v) => !v)}>
                <IconLayers size={15} /> Layers
              </button>
              <button className="btn sm ghost" aria-pressed={lines} onClick={() => setLines((v) => !v)} title="Draw the borders between atlas subdivisions">Subdivision lines</button>
              <button className="btn sm ghost" aria-pressed={atlasColors} onClick={() => setAtlasColors((v) => !v)} title="Give every atlas subdivision its own color">Color atlas</button>
              <button className="btn sm ghost" onClick={() => setAppearance((a) => (a === "tissue" ? "lab" : "tissue"))} title="Switch between realistic tissue colors and lab colors">
                {appearance === "tissue" ? "Realistic" : "Lab view"}
              </button>
              {layersOpen && (
                <div className="layers-menu panel" role="group" aria-label="Show or hide brain parts">
                  {PARTS.map((p) => (
                    <label key={p.id} className="check">
                      <input type="checkbox" checked={visible[p.id]} onChange={() => togglePart(p.id)} /> {p.label}
                    </label>
                  ))}
                  <p className="xs faint">Tip: hide one hemisphere to see the inner surface of the other.</p>
                </div>
              )}
            </div>
            <span className="xs faint hint">Drag to rotate · scroll / pinch to zoom · click a region</span>
          </div>
        )}
      </div>

      {showRegionList && (
        <div className="region-list" role="group" aria-label="Select a brain area">
          {TOP_LEVEL.map((r) => (
            <button
              key={r.id}
              className={`chip region-btn${cited.includes(r.id) ? " cited" : ""}`}
              aria-pressed={selected === r.id}
              onClick={() => onSelect?.(selected === r.id ? null : r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
