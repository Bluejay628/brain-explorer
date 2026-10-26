import { describe, expect, it } from "vitest";
import { DISEASES, detectDisease } from "../shared/diseases.js";
import { REGION_BY_ID, meshKeysOf } from "../shared/regions.js";

describe("Disease staging models", () => {
  it("only use real dictionary regions that the 3D model can draw", () => {
    for (const d of DISEASES) {
      for (const stage of d.stages) {
        for (const [id, v] of Object.entries(stage.regions)) {
          expect(REGION_BY_ID.has(id), `${d.id}: unknown region ${id}`).toBe(true);
          expect(meshKeysOf(id).length, `${d.id}: ${id} has no mesh`).toBeGreaterThan(0);
          expect(v).toBeGreaterThan(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("never show a region getting better in a later stage (models describe spread)", () => {
    for (const d of DISEASES) {
      for (let i = 1; i < d.stages.length; i++) {
        for (const [id, v] of Object.entries(d.stages[i - 1].regions)) {
          const later = d.stages[i].regions[id];
          // A region may be folded into a parent in later stages (e.g. frontal subdivisions → frontal lobe).
          if (later !== undefined) expect(later, `${d.id} ${id}`).toBeGreaterThanOrEqual(v);
        }
      }
    }
  });

  it("every model names its source, a search query, and a caution", () => {
    for (const d of DISEASES) {
      expect(d.sourceLabel).toMatch(/\(\d{4}\)/);
      expect(d.sourceQuery.length).toBeGreaterThan(10);
      expect(d.caution).toMatch(/not a scan/);
    }
  });

  it("detects diseases in questions", () => {
    expect(detectDisease("What does Alzheimer's do to Leo's brain?")?.id).toBe("alzheimers");
    expect(detectDisease("how does parkinsons change the brain")?.id).toBe("parkinsons");
    expect(detectDisease("What happens after repeated head injuries in football?")?.id).toBe("cte");
    expect(detectDisease("What happens when he pulls an all-nighter?")).toBeUndefined();
  });
});
