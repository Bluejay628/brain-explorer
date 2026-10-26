import { useEffect, useRef, useState } from "react";
import { BrainScene, webglAvailable, type Part } from "../brain/scene";
export type { BrainScene };
import { REGIONS, REGION_BY_ID, TOP_LEVEL } from "../../shared/regions";
import { IconCamera, IconLayers, IconPause, IconPlay, IconReset, IconZoomIn, IconZoomOut } from "../icons";

interface Props {
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  cited?: string[];
  pinned?: string[];
  autoRotate?: boolean;
  compact?: boolean; // hero mode: fewer controls
  /** Show the "pick a structure" dropdown and the isolation slider. */
  showRegionList?: boolean;
  caption?: string;
  /** Disease-stage coloring: region id → 0–1. */
  overlay?: Record<string, number> | null;
  /** Short label shown over the brain while an overlay is active. */
  overlayLabel?: string;
  /** What the overlay colors mean (defaults to the disease-staging note). */
  overlayNote?: string;
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

/** Dropdown groups: the main areas first, then the smaller parts inside each one. */
const PICKER_GROUPS: { label: string; regions: typeof REGIONS }[] = [
  { label: "Main areas", regions: TOP_LEVEL },
  ...TOP_LEVEL.map((p) => ({ label: `Inside the ${p.name.toLowerCase()}`, regions: REGIONS.filter((r) => r.parent === p.id && r.kind === "subdivision") })).filter((g) => g.regions.length),
  { label: "Hormone glands (approximate markers)", regions: REGIONS.filter((r) => r.kind === "marker") },
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
  overlayNote = "Published staging model — where changes typically appear, not a scan or measurement.",
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
  const [lines, setLines] = useState(true);
  const [isolation, setIsolation] = useState(0);
  const lineRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
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
  useEffect(() => {
    s()?.setOverlay(overlay);
    if (s()) setVisible(s()!.getVisible());
  }, [JSON.stringify(overlay), status]);
  useEffect(() => {
    if (!overlay) return;
    setSpinning(false);
    if (!selected) s()?.showOverlay();
    if (s()) setVisible(s()!.getVisible());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(overlay), status]);
  useEffect(() => s()?.setIsolation(isolation), [isolation, status]);
  useEffect(() => {
    if (!selected) setIsolation(0);
  }, [selected]);

  // Keep the label line pointing at the selected part while the brain turns.
  useEffect(() => {
    if (!selected || compact) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = s()?.selectedScreenPoint();
      const line = lineRef.current, dot = dotRef.current, host = hostRef.current;
      if (!line || !dot || !host) return;
      const show = Boolean(p);
      line.style.display = dot.style.display = show ? "" : "none";
      if (!p) return;
      const endX = host.clientWidth - 24;
      line.setAttribute("x1", String(p.x));
      line.setAttribute("y1", String(p.y));
      line.setAttribute("x2", String(Math.max(p.x + 40, endX - 230)));
      line.setAttribute("y2", "86");
      dot.setAttribute("cx", String(p.x));
      dot.setAttribute("cy", String(p.y));
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [selected, compact, status]);

  const savePicture = () => {
    const url = s()?.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `brain-explorer-${selected ?? "brain"}.png`;
    a.click();
  };
  const selectedRegion = selected ? REGION_BY_ID.get(selected) : undefined;
  useEffect(() => s()?.setBoundaries(lines), [lines, status]);
  useEffect(() => s()?.setColorAtlas(atlasColors), [atlasColors, status]);

  const togglePart = (p: Part) => {
    const next = { ...visible, [p]: !visible[p] };
    setVisible(next);
    s()?.setVisible(p, next[p]);
  };

  return (
    <div className="viewer" style={{ height: "100%" }}>
      <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
      {status === "loading" && supported && (
        <div className="fallback"><div className="row small dim"><span className="spinner" /> Loading brain model…</div></div>
      )}
      {(!supported || status === "error") && (
        <div className="fallback">
          <div>
            <p>3D view unavailable{!supported ? " — your browser or device doesn't support WebGL" : " — the brain model could not be loaded"}.</p>
            {showRegionList && <p className="small faint" style={{ marginTop: 6 }}>You can still pick a structure from the list above.</p>}
          </div>
        </div>
      )}
      <div ref={tipRef} className="tooltip" style={{ display: "none" }} />

      {/* Label line from the selected part to its name (like an anatomy textbook). */}
      {selectedRegion && !compact && status === "ready" && (
        <>
          <svg className="label-line" aria-hidden="true">
            <line ref={lineRef} />
            <circle ref={dotRef} r={4} />
          </svg>
          <div className="label-name">{selectedRegion.name}</div>
        </>
      )}

      {overlay && overlayLabel && (
        <div className="overlay-legend">
          <div>
            <span className="row" style={{ gap: 8 }}>
              <strong>{overlayLabel}</strong>
              <span className="legend-ramp" style={{ minWidth: 80 }} aria-hidden="true" />
            </span>
            <span className="xs faint">{overlayNote}</span>
          </div>
        </div>
      )}

      {!compact && (
        <div className="hud top">
          {showRegionList ? (
            <label className="picker">
              <span className="sr-only">Pick a brain structure</span>
              <select className="select" value={selected ?? ""} onChange={(e) => onSelect?.(e.target.value || null)}>
                <option value="">Whole brain — pick a structure…</option>
                {PICKER_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.regions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}{cited.includes(r.id) ? "  • in answer" : ""}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          ) : <span />}
          <div className="controls" role="toolbar" aria-label="Brain view controls">
            <button className="btn sm icon ghost" onClick={() => s()?.zoom(0.85)} aria-label="Zoom in" title="Zoom in"><IconZoomIn size={20} /></button>
            <button className="btn sm icon ghost" onClick={() => s()?.zoom(1.18)} aria-label="Zoom out" title="Zoom out"><IconZoomOut size={20} /></button>
            <button className="btn sm icon ghost" onClick={() => s()?.reset()} aria-label="Reset view" title="Reset view"><IconReset size={20} /></button>
            <button className="btn sm icon ghost" onClick={() => setSpinning((v) => !v)} aria-pressed={spinning} aria-label="Spin slowly" title="Spin slowly">
              {spinning ? <IconPause size={20} /> : <IconPlay size={20} />}
            </button>
            <button className="btn sm icon ghost" onClick={savePicture} aria-label="Save a picture" title="Save a picture (PNG)"><IconCamera size={20} /></button>
            <button className="btn sm icon ghost" aria-expanded={layersOpen} onClick={() => setLayersOpen((v) => !v)} aria-label="Show or hide parts" title="Show or hide parts">
              <IconLayers size={20} />
            </button>
            {layersOpen && (
              <div className="layers-menu panel" role="group" aria-label="Show or hide brain parts">
                {PARTS.map((p) => (
                  <label key={p.id} className="check">
                    <input type="checkbox" checked={visible[p.id]} onChange={() => togglePart(p.id)} /> {p.label}
                  </label>
                ))}
                <hr className="divider" />
                <label className="check"><input type="checkbox" checked={lines} onChange={() => setLines((v) => !v)} /> Outline each part</label>
                <label className="check"><input type="checkbox" checked={atlasColors} onChange={() => setAtlasColors((v) => !v)} /> Give each part its own color</label>
                <p className="xs faint">Tip: hide one half to see the inner surface of the other.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!compact && (
        <div className="hud bottom">
          {showRegionList && (
            <label className="isolation" title={selected ? "Fade everything except the selected part" : "Pick a structure first"}>
              <span>Structure isolation</span>
              <input type="range" min={0} max={1} step={0.01} value={isolation} disabled={!selected} onChange={(e) => setIsolation(Number(e.target.value))} />
            </label>
          )}
          <span className="xs faint hint">{caption ?? "Average adult brain model — shows where parts are, not brain activity"} · drag to turn · scroll to zoom · click a part</span>
        </div>
      )}
      {compact && caption && <div className="hud bottom"><span className="xs faint hint">{caption}</span></div>}
    </div>
  );
}
