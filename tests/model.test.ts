// The 3D brain model file: every cortex point has a position, depth, curvature and
// region label, and the labels only use region keys the app knows.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { regionForMeshKey } from "../shared/regions.js";

const model = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "models", "brain.json"), "utf8"));
const bytes = (b64: string) => Buffer.from(b64, "base64");

describe("brain model", () => {
  for (const h of ["lh", "rh"] as const) {
    it(`${h}: arrays all have one entry per point`, () => {
      const c = model.cortex[h];
      expect(c.vertexCount).toBe(40962); // fsaverage6
      expect(bytes(c.positions).length).toBe(c.vertexCount * 3 * 2);
      expect(bytes(c.sulc).length).toBe(c.vertexCount);
      expect(bytes(c.curv).length).toBe(c.vertexCount);
      expect(bytes(c.labels).length).toBe(c.vertexCount);
      const idx = new Uint16Array(new Uint8Array(bytes(c.indices)).buffer);
      expect(idx.reduce((m, v) => Math.max(m, v), 0)).toBeLessThan(c.vertexCount);
    });
  }

  it("every cortical region key maps to a region in the app", () => {
    for (const r of model.regions) expect(regionForMeshKey(r.key), r.key).toBeDefined();
  });
});
