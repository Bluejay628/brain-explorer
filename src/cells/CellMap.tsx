import { useEffect, useRef } from "react";
import type { CellAtlas } from "./useCellAtlas";

interface Props {
  data: CellAtlas;
  /** Dissection indexes to show in color (others turn grey). null = all. */
  rois: Set<number> | null;
  /** Supercluster to show in color (others turn grey). null = all. */
  supercluster: number | null;
  onPick?: (supercluster: number) => void;
}

const GRID = 64;

/**
 * The "cell map": every dot is one real cell nucleus. Cells with similar gene
 * activity sit close together (a UMAP layout computed by the study), so the
 * clumps are cell types. Position on the map is NOT a place in the brain.
 */
export function CellMap({ data, rois, supercluster, onPick }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<number[][]>([]);

  // Bucket points once so hovering can find the nearest cell quickly.
  useEffect(() => {
    const grid: number[][] = Array.from({ length: GRID * GRID }, () => []);
    for (let i = 0; i < data.px.length; i++) {
      const gx = Math.min(GRID - 1, Math.floor(data.px[i] * GRID));
      const gy = Math.min(GRID - 1, Math.floor(data.py[i] * GRID));
      grid[gy * GRID + gx].push(i);
    }
    gridRef.current = grid;
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth, h = wrap.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      const pad = 10;
      const colors = data.superclusters.map((s) => s.color);
      const size = w < 420 ? 1.4 : 1.8;
      const on = (i: number) => (rois ? rois.has(data.pRoi[i]) : true) && (supercluster === null || data.pSuper[i] === supercluster);
      // Grey (filtered-out) cells first, colored cells on top.
      ctx.fillStyle = "#ddd7d4";
      for (let i = 0; i < data.px.length; i++) {
        if (on(i)) continue;
        ctx.fillRect(pad + data.px[i] * (w - 2 * pad), pad + (1 - data.py[i]) * (h - 2 * pad), size, size);
      }
      for (let i = 0; i < data.px.length; i++) {
        if (!on(i)) continue;
        ctx.fillStyle = colors[data.pSuper[i]];
        ctx.fillRect(pad + data.px[i] * (w - 2 * pad), pad + (1 - data.py[i]) * (h - 2 * pad), size, size);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [data, rois, supercluster]);

  const nearest = (clientX: number, clientY: number): number | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const pad = 10;
    const x = (clientX - rect.left - pad) / (rect.width - 2 * pad);
    const y = 1 - (clientY - rect.top - pad) / (rect.height - 2 * pad);
    const gx = Math.floor(x * GRID), gy = Math.floor(y * GRID);
    let best: number | null = null, bestD = (6 / rect.width) ** 2;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cell = gridRef.current[(gy + dy) * GRID + gx + dx];
        if (!cell || gx + dx < 0 || gx + dx >= GRID) continue;
        for (const i of cell) {
          const d = (data.px[i] - x) ** 2 + (data.py[i] - y) ** 2;
          if (d < bestD) (bestD = d), (best = i);
        }
      }
    return best;
  };

  const onMove = (e: React.PointerEvent) => {
    const tip = tipRef.current, wrap = wrapRef.current;
    if (!tip || !wrap) return;
    const i = nearest(e.clientX, e.clientY);
    if (i === null) {
      tip.style.display = "none";
      return;
    }
    const rect = wrap.getBoundingClientRect();
    const roi = data.rois[data.pRoi[i]];
    tip.style.display = "block";
    tip.style.left = `${e.clientX - rect.left}px`;
    tip.style.top = `${e.clientY - rect.top}px`;
    tip.textContent = `${data.superclusters[data.pSuper[i]].name} · from ${roi.structures[0]?.name ?? roi.label}`;
  };

  return (
    <div
      ref={wrapRef}
      className="cell-map-wrap"
      onPointerMove={onMove}
      onPointerLeave={() => tipRef.current && (tipRef.current.style.display = "none")}
      onClick={(e) => {
        const i = nearest(e.clientX, e.clientY);
        if (i !== null) onPick?.(data.pSuper[i]);
      }}
    >
      <canvas ref={canvasRef} role="img" aria-label="Cell map: each dot is one sampled brain cell, grouped by cell type" />
      <div ref={tipRef} className="tooltip" style={{ display: "none" }} />
    </div>
  );
}
