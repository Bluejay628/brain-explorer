"""
Builds public/models/brain.json — the anatomical brain model used by the 3D viewer.

Sources (see README → "3D brain model: sources and licenses"):
  * Cortical surface: FreeSurfer `fsaverage5` pial surface + sulcal depth, as
    redistributed inside the nilearn Python package (nilearn/datasets/data/fsaverage5).
  * Cortical parcellation: Desikan-Killiany atlas (Desikan et al., 2006) on
    fsaverage5, as packaged by ggseg.formats (MIT license, R/sysdata.rda).
  * Subcortical meshes: FreeSurfer `aseg` structures on fsaverage5, as packaged
    by ggseg.formats.

The ggseg subcortical meshes use a different coordinate origin than the
surfaces. The offset below was measured by rigidly fitting (ICP, translation
only) the aseg corpus callosum onto the surface corpus-callosum label:
residual ≈ 1.6 mm. After the shift, structure centroids fall at standard
MNI-like positions (e.g. left hippocampus ≈ (-25, -23, -14)).

Run (needs: pip install rdata nibabel numpy):
    git clone --depth 1 https://github.com/ggsegverse/ggseg.formats
    pip download nilearn --no-deps   # then unzip the .whl
    python scripts/build-brain-model.py <ggseg.formats dir> <nilearn fsaverage5 data dir>
"""

import base64
import json
import sys
import warnings
from datetime import date
from pathlib import Path

import nibabel as nib
import numpy as np
import rdata

warnings.filterwarnings("ignore")

SUBCORTICAL_OFFSET_MM = np.array([0.0, -23.33, 11.86])
CENTER_MM = np.array([0.0, -18.0, 8.0])  # roughly the middle of the brain
SCALE = 1 / 80.0  # mm → scene units (brain ≈ 2 units long)
QUANT = 20000  # int16 quantization factor for scene units

SKIP_ASEG = {"Left-vessel", "Right-vessel", "Left-choroid-plexus", "Right-choroid-plexus", "Optic-Chiasm"}
CC_PARTS = ["CC_Posterior", "CC_Mid_Posterior", "CC_Central", "CC_Mid_Anterior", "CC_Anterior"]

ASEG_KEYS = {
    "Cerebellum-Cortex": "cerebellum",
    "Thalamus": "thalamus",
    "Caudate": "caudate",
    "Putamen": "putamen",
    "Pallidum": "pallidum",
    "Hippocampus": "hippocampus",
    "Amygdala": "amygdala",
    "Accumbens-area": "nucleus-accumbens",
    "VentralDC": "ventral-diencephalon",
}


def b64(a: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode("ascii")


def to_scene(mm: np.ndarray) -> np.ndarray:
    """MNI-like RAS millimetres → three.js scene (x right, y up, z = posterior)."""
    p = (mm - CENTER_MM) * SCALE
    scene = np.stack([p[:, 0], p[:, 2], -p[:, 1]], axis=1)  # proper rotation, keeps handedness
    return np.round(scene * QUANT).astype(np.int16)


def main(ggseg_dir: str, fs5_dir: str, out: str) -> None:
    conv = rdata.conversion.convert(
        rdata.parser.parse_file(str(Path(ggseg_dir) / "R" / "sysdata.rda")), default_encoding="utf8"
    )
    dk = conv[".dk_atlas"]
    core = dk["core"]
    region_keys = sorted(set(core.region) - {"corpuscallosum"})
    region_meta = []
    for key in region_keys:
        row = core[core.region == key].iloc[0]
        region_meta.append({"key": key, "display": str(row.display), "lobe": str(row.lobe)})
    index_of = {k: i for i, k in enumerate(region_keys)}
    vert_table = dk["data"]["vertices"]

    cortex = {}
    for hemi, h in (("left", "lh"), ("right", "rh")):
        gii = nib.load(str(Path(fs5_dir) / f"pial_{hemi}.gii.gz"))
        pos, faces = gii.darrays[0].data.astype(np.float64), gii.darrays[1].data
        sulc = nib.load(str(Path(fs5_dir) / f"sulc_{hemi}.gii.gz")).darrays[0].data
        labels = np.full(len(pos), 255, dtype=np.uint8)  # 255 = medial wall / unlabeled
        for key, i in index_of.items():
            rows = vert_table[vert_table.label == f"{h}_{key}"]
            if len(rows):
                labels[np.asarray(rows.vertices.values[0]).astype(int)] = i
        s = np.clip(sulc / np.abs(sulc).max(), -1, 1)
        cortex[h] = {
            "positions": b64(to_scene(pos)),
            "indices": b64(faces.astype(np.uint16)),
            "sulc": b64(np.round(s * 127).astype(np.int8)),
            "labels": b64(labels),
            "vertexCount": int(len(pos)),
        }

    meshes = conv[".aseg_atlas"]["data"]["meshes"]
    sub = []

    def add(key, hemi, verts_mm, faces):
        sub.append({
            "key": key,
            "hemi": hemi,
            "positions": b64(to_scene(verts_mm + SUBCORTICAL_OFFSET_MM)),
            "indices": b64(faces.astype(np.uint32)),
            "vertexCount": int(len(verts_mm)),
        })

    for _, row in meshes.iterrows():
        label = str(row.label)
        if label in SKIP_ASEG or label in CC_PARTS:
            continue
        v = row.mesh["vertices"][["x", "y", "z"]].to_numpy()
        f = row.mesh["faces"][["i", "j", "k"]].to_numpy()
        f = f - f.min() if f.min() == 1 else f  # R meshes may be 1-based
        if label == "Brain-Stem":
            add("brainstem", "both", v, f)
            continue
        hemi, name = label.split("-", 1)
        add(ASEG_KEYS[name], hemi.lower(), v, f)

    # Merge the five corpus callosum segments into one mesh.
    vs, fs, off = [], [], 0
    for label in CC_PARTS:
        row = meshes[meshes.label == label].iloc[0]
        v = row.mesh["vertices"][["x", "y", "z"]].to_numpy()
        f = row.mesh["faces"][["i", "j", "k"]].to_numpy()
        f = f - f.min() if f.min() == 1 else f
        vs.append(v)
        fs.append(f + off)
        off += len(v)
    add("corpus-callosum", "both", np.vstack(vs), np.vstack(fs))

    model = {
        "format": "brain-explorer-model/1",
        "generated": date.today().isoformat(),
        "quantization": QUANT,
        "coordinateNote": "Scene units = (MNI-like mm - center) / 80; x right, y up, z posterior. fsaverage is an average adult brain.",
        "attribution": [
            "Cortical surface: FreeSurfer fsaverage5 (Fischl et al., 1999), via nilearn (BSD-3).",
            "Cortical regions: Desikan-Killiany atlas (Desikan et al., 2006), via ggseg.formats (MIT).",
            "Subcortical meshes: FreeSurfer aseg on fsaverage5 (Fischl et al., 2002), via ggseg.formats (MIT).",
        ],
        "regions": region_meta,
        "cortex": cortex,
        "subcortical": sub,
    }
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(json.dumps(model, separators=(",", ":")))
    print(f"Wrote {out}: {Path(out).stat().st_size / 1e6:.2f} MB, {len(region_meta)} cortical regions, {len(sub)} subcortical meshes")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "public/models/brain.json")
