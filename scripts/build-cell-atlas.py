"""
Builds public/data/cell-atlas.json — the human brain cell-type data used by the
"Cells" tab.

Source: Allen Brain Cell Atlas (Allen Institute), human whole-brain dataset
"WHB-10Xv3" with the "WHB-taxonomy" cell-type tree. The data come from:
  Siletti K, et al. Transcriptomic diversity of cell types across the adult
  human brain. Science 2023;382(6667):eadd7046. doi:10.1126/science.add7046
Files are read from the public bucket
  https://allen-brain-cell-atlas.s3.us-west-2.amazonaws.com/
(see the ABC Atlas manifest). Use is subject to the Allen Institute terms of use.

What the output contains (all counted directly from the cell table, nothing estimated):
  * superclusters: the 31 top-level cell types (name, Allen color, cell count)
  * rois: each dissection the cells were taken from, with how many sampled
    nuclei of each supercluster and neurotransmitter type came from it
  * points: a fixed 1-in-SAMPLE_EVERY subset of all cells with their UMAP
    position, supercluster and dissection — enough to draw the cell map

Counts describe SAMPLED nuclei from 4 donors. They are not cell densities:
the study chose how much tissue to sample from each area.

Run (Python 3.9+, standard library only, streams the 830 MB cell table):
    python scripts/build-cell-atlas.py
"""

import base64
import csv
import io
import json
import struct
import sys
import urllib.request
import zlib
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

BUCKET = "https://allen-brain-cell-atlas.s3.us-west-2.amazonaws.com"
CELLS = f"{BUCKET}/metadata/WHB-10Xv3/20241115/cell_metadata.csv"
ROI_MAP = f"{BUCKET}/metadata/WHB-10Xv3/20241115/region_of_interest_structure_map.csv"
DONORS = f"{BUCKET}/metadata/WHB-10Xv3/20241115/donor.csv"
TERMS = f"{BUCKET}/metadata/WHB-taxonomy/20240330/cluster_annotation_term.csv"
MEMBERSHIP = f"{BUCKET}/metadata/WHB-taxonomy/20240330/cluster_to_cluster_annotation_membership.csv"
SAMPLE_EVERY = 40  # keep ~1 in 40 cells for the map (deterministic, by cell label)
OUT = Path(__file__).resolve().parent.parent / "public" / "data" / "cell-atlas.json"


def read_csv(url):
    with urllib.request.urlopen(url) as r:
        return list(csv.DictReader(io.TextIOWrapper(r, encoding="utf-8")))


def b64(fmt, values):
    return base64.b64encode(struct.pack(f"<{len(values)}{fmt}", *values)).decode()


def main():
    terms = read_csv(TERMS)
    supers = [t for t in terms if t["cluster_annotation_term_set_name"] == "supercluster"]
    supers.sort(key=lambda t: int(t["term_order"]))
    super_index = {t["name"]: i for i, t in enumerate(supers)}

    cluster_super, cluster_nt = {}, {}
    for m in read_csv(MEMBERSHIP):
        if m["cluster_annotation_term_set_name"] == "supercluster":
            cluster_super[m["cluster_alias"]] = super_index[m["cluster_annotation_term_name"]]
        elif m["cluster_annotation_term_set_name"] == "neurotransmitter":
            cluster_nt[m["cluster_alias"]] = m["cluster_annotation_term_name"]

    roi_structures = defaultdict(list)
    for r in read_csv(ROI_MAP):
        roi_structures[r["region_of_interest_label"]].append({"symbol": r["structure_symbol"], "name": r["structure_name"], "id": r["structure_identifier"]})

    roi_index, roi_division = {}, {}
    roi_super = defaultdict(Counter)
    roi_nt = defaultdict(Counter)
    roi_donors = defaultdict(set)
    xs, ys, ps, pr = [], [], [], []
    total = 0

    with urllib.request.urlopen(CELLS) as r:
        for row in csv.DictReader(io.TextIOWrapper(r, encoding="utf-8")):
            total += 1
            roi = row["region_of_interest_label"]
            if roi not in roi_index:
                roi_index[roi] = len(roi_index)
                roi_division[roi] = row["anatomical_division_label"]
            s = cluster_super[row["cluster_alias"]]
            roi_super[roi][s] += 1
            roi_nt[roi][cluster_nt[row["cluster_alias"]]] += 1
            roi_donors[roi].add(row["donor_label"])
            if zlib.crc32(row["cell_label"].encode()) % SAMPLE_EVERY == 0:
                xs.append(float(row["x"]))
                ys.append(float(row["y"]))
                ps.append(s)
                pr.append(roi_index[roi])
            if total % 500_000 == 0:
                print(f"  {total:,} cells read…", file=sys.stderr)

    lo_x, hi_x, lo_y, hi_y = min(xs), max(xs), min(ys), max(ys)
    qx = [round((x - lo_x) / (hi_x - lo_x) * 65535) - 32768 for x in xs]
    qy = [round((y - lo_y) / (hi_y - lo_y) * 65535) - 32768 for y in ys]

    rois = sorted(roi_index, key=roi_index.get)
    out = {
        "source": {
            "name": "Allen Brain Cell Atlas — human whole-brain dataset (WHB-10Xv3, WHB-taxonomy)",
            "citation": "Siletti K, et al. Transcriptomic diversity of cell types across the adult human brain. Science. 2023;382(6667):eadd7046.",
            "doi": "10.1126/science.add7046",
            "url": "https://knowledge.brain-map.org/abcatlas",
            "files": [CELLS, ROI_MAP, TERMS, MEMBERSHIP],
            "donors": read_csv(DONORS),
            "built": date.today().isoformat(),
        },
        "totalCells": total,
        "superclusters": [{"name": t["name"], "color": t["color_hex_triplet"], "cells": int(t["number_of_cells"])} for t in supers],
        "rois": [
            {
                "label": roi,
                "division": roi_division[roi],
                "structures": roi_structures.get(roi, []),
                "cells": sum(roi_super[roi].values()),
                "donors": len(roi_donors[roi]),
                "superclusters": {str(k): v for k, v in sorted(roi_super[roi].items())},
                "neurotransmitters": dict(roi_nt[roi].most_common()),
            }
            for roi in rois
        ],
        "points": {
            "sampleEvery": SAMPLE_EVERY,
            "count": len(qx),
            "x": b64("h", qx),
            "y": b64("h", qy),
            "supercluster": b64("B", ps),
            "roi": b64("B", pr),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {OUT} — {total:,} cells, {len(rois)} dissections, {len(qx):,} map points", file=sys.stderr)


if __name__ == "__main__":
    main()
