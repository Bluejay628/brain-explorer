import { useEffect, useRef, useState } from "react";
import { BrainScene, webglAvailable } from "../brain/scene";
import { REGIONS, REGION_BY_ID } from "../../shared/regions";
import { IconLayers, IconPause, IconPlay, IconReset, IconRotateL, IconRotateR, IconZoomIn, IconZoomOut } from "../icons";

interface Props {
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  cited?: string[];
  autoRotate?: boolean;
  compact?: boolean; // hero mode: fewer controls
  showRegionList?: boolean;
}

const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function BrainViewer({ selected = null, onSelect, cited = [], autoRotate = true, compact = false, showRegionList = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BrainScene | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [supported] = useState(() => webglAvailable());
  const [spinning, setSpinning] = useState(autoRotate && !reducedMotion);
  const [xray, setXray] = useState(false);
  const [lobes, setLobes] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supported || !hostRef.current) return;
    let scene: BrainScene;
    try {
      scene = new BrainScene(hostRef.current, {
        autoRotate: autoRotate && !reducedMotion,
        onSelect: (id) => onSelectRef.current?.(id),
        onHover: (id, x, y) => {
          const tip = tipRef.current;
          if (!tip) return;
          if (!id) {
            tip.style.display = "none";
            return;
          }
          tip.style.display = "block";
          tip.style.left = `${x}px`;
          tip.style.top = `${y}px`;
          tip.textContent = REGION_BY_ID.get(id)?.name ?? id;
        },
      });
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  useEffect(() => sceneRef.current?.setSelected(selected), [selected]);
  useEffect(() => sceneRef.current?.setCited(cited), [cited.join(",")]);
  useEffect(() => sceneRef.current?.setAutoRotate(spinning), [spinning]);
  useEffect(() => sceneRef.current?.setXray(xray), [xray]);
  useEffect(() => sceneRef.current?.setShowLobes(lobes), [lobes]);
  // Selecting a deep structure switches x-ray on inside the scene; mirror that in the button.
  useEffect(() => {
    if (selected && REGION_BY_ID.get(selected)?.kind === "deep-structure") setXray(true);
  }, [selected]);
  useEffect(() => {
    if (selected) setSpinning(false);
  }, [selected]);

  const s = () => sceneRef.current;

  return (
    <div className="stack-sm" style={{ height: "100%" }}>
      <div className="viewer" style={{ flex: 1 }}>
        <div ref={hostRef} style={{ position: "absolute", inset: 0 }} />
        {(!supported || failed) && (
          <div className="fallback">
            <div>
              <p>3D view unavailable — your browser or device doesn't support WebGL.</p>
              <p className="small faint" style={{ marginTop: 6 }}>You can still select regions from the list below.</p>
            </div>
          </div>
        )}
        <div ref={tipRef} className="tooltip" style={{ display: "none" }} />

        <div className="hud top">
          <span className="model-label">
            Schematic placeholder model · approximate regions for orientation · not an activity map
          </span>
          {!compact && (
            <div className="controls" role="toolbar" aria-label="Brain view controls">
              <button className="btn sm icon ghost" onClick={() => s()?.rotate(-30)} aria-label="Rotate left" title="Rotate left"><IconRotateL size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => s()?.rotate(30)} aria-label="Rotate right" title="Rotate right"><IconRotateR size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => s()?.zoom(0.85)} aria-label="Zoom in" title="Zoom in"><IconZoomIn size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => s()?.zoom(1.18)} aria-label="Zoom out" title="Zoom out"><IconZoomOut size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => s()?.reset()} aria-label="Reset view" title="Reset view"><IconReset size={17} /></button>
              <button className="btn sm icon ghost" onClick={() => setSpinning((v) => !v)} aria-pressed={spinning} aria-label="Auto-rotate" title="Auto-rotate">
                {spinning ? <IconPause size={16} /> : <IconPlay size={16} />}
              </button>
            </div>
          )}
        </div>

        {!compact && (
          <div className="hud bottom">
            <div className="controls">
              <button className="btn sm ghost" aria-pressed={xray} onClick={() => setXray((v) => !v)} title="See deep structures through a transparent cortex">
                <IconLayers size={15} /> Deep structures
              </button>
              <button className="btn sm ghost" aria-pressed={lobes} onClick={() => setLobes((v) => !v)} title="Tint the approximate lobes">
                Show lobes
              </button>
            </div>
            <span className="xs faint" style={{ background: "rgba(5,9,18,.7)", padding: "3px 8px", borderRadius: 4 }}>
              Drag to rotate · scroll / pinch to zoom · click a region
            </span>
          </div>
        )}
      </div>

      {showRegionList && (
        <div className="region-list" role="group" aria-label="Select a brain region">
          {REGIONS.map((r) => (
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
