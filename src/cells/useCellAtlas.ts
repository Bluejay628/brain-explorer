// Loads public/data/cell-atlas.json (real counts from the Allen Brain Cell Atlas
// human whole-brain dataset — see scripts/build-cell-atlas.py) once, and decodes
// the packed cell-map points.

import { useEffect, useState } from "react";
import type { CellAtlasFile } from "../../shared/cellAtlas";

export interface CellAtlas extends CellAtlasFile {
  /** Cell-map points: position 0–1, supercluster index, dissection index. */
  px: Float32Array;
  py: Float32Array;
  pSuper: Uint8Array;
  pRoi: Uint8Array;
}

function bytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

let promise: Promise<CellAtlas> | null = null;
function load(): Promise<CellAtlas> {
  promise ??= fetch("/data/cell-atlas.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Cell data failed to load (HTTP ${r.status})`);
      return r.json() as Promise<CellAtlasFile>;
    })
    .then((f) => {
      const norm = (b64: string) => Float32Array.from(new Int16Array(bytes(b64)), (v) => (v + 32768) / 65535);
      return { ...f, px: norm(f.points.x), py: norm(f.points.y), pSuper: new Uint8Array(bytes(f.points.supercluster)), pRoi: new Uint8Array(bytes(f.points.roi)) };
    });
  promise.catch(() => (promise = null));
  return promise;
}

export function useCellAtlas() {
  const [data, setData] = useState<CellAtlas | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((d) => alive && setData(d)).catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);
  return { data, error };
}
