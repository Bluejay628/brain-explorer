"""
Upgrades the cortex in public/models/brain.json from fsaverage5 (10,242 points
per hemisphere) to the 4x more detailed fsaverage6 (40,962 points), so the
folds look sharper. The deep structures already in the file are kept.

Source: TemplateFlow's copy of FreeSurfer fsaverage (public bucket
https://templateflow.s3.amazonaws.com/tpl-fsaverage/), "den-41k" files:
  * pial surface, sulcal depth (sulc) and curvature (curv)
  * Desikan-Killiany atlas labels (Desikan et al., 2006)
FreeSurfer fsaverage: Fischl et al., 1999. FreeSurfer license applies.

Safety check: fsaverage meshes are nested (the first 10,242 points of
fsaverage6 ARE the fsaverage5 points), so the script confirms they match the
current model before replacing anything.

Run (needs numpy; run scripts/build-brain-model.py first):
    python scripts/build-cortex-fsaverage6.py
"""

import base64
import gzip
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zlib
from datetime import date
from pathlib import Path

import numpy as np

BASE = "https://templateflow.s3.amazonaws.com/tpl-fsaverage/tpl-fsaverage_hemi-{H}_den-41k_{name}"
MODEL = Path(__file__).resolve().parent.parent / "public" / "models" / "brain.json"
CENTER_MM = np.array([0.0, -18.0, 8.0])  # same as build-brain-model.py
SCALE = 1 / 80.0
DTYPES = {"NIFTI_TYPE_FLOAT32": np.float32, "NIFTI_TYPE_INT32": np.int32, "NIFTI_TYPE_UINT8": np.uint8}


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url) as r:
        data = r.read()
    return gzip.decompress(data) if data[:2] == b"\x1f\x8b" else data


def read_gifti(url: str):
    """Minimal GIFTI reader: returns (data arrays, label table {key: name})."""
    root = ET.fromstring(fetch(url))
    arrays = []
    for da in root.iter("DataArray"):
        raw = da.find("Data").text.strip()
        dtype = DTYPES[da.get("DataType")]
        enc = da.get("Encoding")
        if enc == "ASCII":
            arr = np.array(raw.split(), dtype=dtype)
        else:
            buf = base64.b64decode(raw)
            if enc == "GZipBase64Binary":
                buf = zlib.decompress(buf)
            arr = np.frombuffer(buf, dtype=np.dtype(dtype).newbyteorder(">" if da.get("Endian") == "BigEndian" else "<"))
        dims = [int(da.get(f"Dim{i}")) for i in range(int(da.get("Dimensionality")))]
        arrays.append(arr.reshape(dims, order="F" if da.get("ArrayIndexingOrder") == "ColumnMajorOrder" else "C"))
    labels = {int(l.get("Key")): (l.text or "").strip() for l in root.iter("Label")}
    return arrays, labels


def b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode("ascii")


def to_scene(mm: np.ndarray, quant: int) -> np.ndarray:
    p = (mm - CENTER_MM) * SCALE
    scene = np.stack([p[:, 0], p[:, 2], -p[:, 1]], axis=1)
    return np.round(scene * quant).astype(np.int16)


def norm_int8(v: np.ndarray, pct: float) -> np.ndarray:
    """Scale to -1..1 using a robust percentile (so a few extreme points don't flatten the rest)."""
    s = np.clip(v / np.percentile(np.abs(v), pct), -1, 1)
    return np.round(s * 127).astype(np.int8)


def main() -> None:
    model = json.loads(MODEL.read_text())
    q = model["quantization"]
    index_of = {r["key"]: i for i, r in enumerate(model["regions"])}

    for H, h in (("L", "lh"), ("R", "rh")):
        (pos, faces), _ = read_gifti(BASE.format(H=H, name="pial.surf.gii"))
        (sulc,), _ = read_gifti(BASE.format(H=H, name="sulc.shape.gii"))
        (curv,), _ = read_gifti(BASE.format(H=H, name="curv.shape.gii"))
        (lab,), table = read_gifti(BASE.format(H=H, name="atlas-Desikan2006_seg-aparc_dseg.label.gii"))
        pos = pos.astype(np.float64)

        # Safety check against the current fsaverage5 model.
        old = np.frombuffer(base64.b64decode(model["cortex"][h]["positions"]), dtype=np.int16).reshape(-1, 3)
        new = to_scene(pos, q)[: len(old)]
        err_mm = np.abs(new.astype(float) - old).max() / q / SCALE
        if err_mm > 0.5:
            sys.exit(f"{h}: fsaverage6 does not line up with the current model (max {err_mm:.2f} mm) — not replacing.")

        labels = np.full(len(pos), 255, dtype=np.uint8)  # 255 = medial wall / unlabeled
        for key, name in table.items():
            if name in index_of:
                labels[lab == key] = index_of[name]

        model["cortex"][h] = {
            "positions": b64(to_scene(pos, q)),
            "indices": b64(faces.astype(np.uint16)),
            "sulc": b64(norm_int8(sulc, 99.5)),
            "curv": b64(norm_int8(curv, 98)),
            "labels": b64(labels),
            "vertexCount": int(len(pos)),
        }
        print(f"{h}: {len(pos):,} points, {len(faces):,} triangles (lines up with fsaverage5 within {err_mm:.2f} mm)", file=sys.stderr)

    model["generated"] = date.today().isoformat()
    model["attribution"] = [
        "Cortical surface: FreeSurfer fsaverage6 pial surface, sulcal depth and curvature (Fischl et al., 1999), via TemplateFlow (tpl-fsaverage).",
        "Cortical regions: Desikan-Killiany atlas (Desikan et al., 2006) on fsaverage6, via TemplateFlow.",
        "Subcortical meshes: FreeSurfer aseg on fsaverage5 (Fischl et al., 2002), via ggseg.formats (MIT).",
    ]
    MODEL.write_text(json.dumps(model, separators=(",", ":")))
    print(f"Wrote {MODEL}: {MODEL.stat().st_size / 1e6:.2f} MB", file=sys.stderr)


if __name__ == "__main__":
    main()
