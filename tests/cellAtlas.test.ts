// The Cells tab shows real counts from the Allen Brain Cell Atlas. These tests
// check that the stored data file is internally consistent and that every
// region → tissue-sample link points at something that really exists.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGION_BY_ID } from "../shared/regions.js";
import { REGION_SAMPLES, combineSamples, groupNeurotransmitters, samplesFor, type CellAtlasFile } from "../shared/cellAtlas.js";

const file: CellAtlasFile = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "data", "cell-atlas.json"), "utf8"));

describe("Allen Brain Cell Atlas data", () => {
  it("names its source", () => {
    expect(file.source.doi).toBe("10.1126/science.add7046");
    expect(file.source.files.every((f) => f.startsWith("https://allen-brain-cell-atlas.s3"))).toBe(true);
  });

  it("per-sample counts add up to the total number of cells", () => {
    const sum = file.rois.reduce((n, r) => n + r.cells, 0);
    expect(sum).toBe(file.totalCells);
    for (const r of file.rois) {
      expect(Object.values(r.superclusters).reduce((a, b) => a + b, 0)).toBe(r.cells);
      expect(Object.values(r.neurotransmitters).reduce((a, b) => a + b, 0)).toBe(r.cells);
    }
  });

  it("cell-type totals match the taxonomy's own counts", () => {
    file.superclusters.forEach((s, i) => {
      const counted = file.rois.reduce((n, r) => n + (r.superclusters[String(i)] ?? 0), 0);
      expect(counted, s.name).toBe(s.cells);
    });
  });

  it("every linked region exists in the app and every linked sample exists in the data", () => {
    const labels = new Set(file.rois.map((r) => r.label));
    const divisions = new Set(file.rois.map((r) => `division:${r.division}`));
    for (const [regionId, wanted] of Object.entries(REGION_SAMPLES)) {
      expect(REGION_BY_ID.has(regionId), regionId).toBe(true);
      for (const w of wanted) expect(labels.has(w) || divisions.has(w), `${regionId} → ${w}`).toBe(true);
      expect(samplesFor(regionId, file.rois).length, regionId).toBeGreaterThan(0);
    }
  });

  it("regions without a clear match get no cell data (not a guess)", () => {
    expect(samplesFor("corpus-callosum", file.rois)).toEqual([]);
    expect(samplesFor("pituitary-gland", file.rois)).toEqual([]);
  });

  it("combines samples and groups messengers in plain language", () => {
    const c = combineSamples(samplesFor("hippocampus", file.rois));
    expect(c.cells).toBeGreaterThan(0);
    const names = groupNeurotransmitters(c.neurotransmitters).map((g) => g.name);
    expect(names).toContain("Glutamate (excitatory)");
    expect(names).toContain("GABA (inhibitory)");
  });
});
