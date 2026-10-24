// NeuroVault lookup: does a study have published statistical brain maps?
// API: https://neurovault.org/api/  (collections can be filtered by DOI)
//
// Brain Explorer NEVER generates a map. It only reports maps that the
// researchers themselves uploaded to NeuroVault, links to them, and explains
// why they are not drawn on this app's schematic 3D model.

import type { BrainMapAvailability, ResearchRecord } from "../../shared/types.js";
import { politeFetch, RateLimiter, type FetchOptions } from "../research/http.js";

const BASE = "https://neurovault.org/api";
const limiter = new RateLimiter(500);
const cache = new Map<string, { at: number; value: BrainMapAvailability }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

export const SCHEMATIC_RENDER_NOTE =
  "Not drawn on the 3D brain: this app's model is a schematic placeholder without a standard (MNI) coordinate space, so overlaying a statistical map would be misleading. Open the map on NeuroVault to view it on a proper template.";

export async function lookupBrainMaps(record: ResearchRecord, fetchOpts: FetchOptions = {}): Promise<BrainMapAvailability> {
  if (!record.doi) {
    return { recordId: record.id, status: "not-checked", renderNote: "No DOI is listed for this study, so NeuroVault could not be searched." };
  }
  const hit = cache.get(record.doi);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  try {
    const body = await politeFetch(`${BASE}/collections/?DOI=${encodeURIComponent(record.doi)}&format=json`, {
      limiter,
      retries: 1,
      timeoutMs: 8_000,
      ...fetchOpts,
    });
    const json = JSON.parse(body);
    const collections: any[] = Array.isArray(json?.results) ? json.results : [];
    // Only accept a collection whose DOI exactly matches the study's DOI.
    const col = collections.find((c) => String(c?.DOI ?? "").toLowerCase() === record.doi);
    let value: BrainMapAvailability;
    if (!col || typeof col.id !== "number") {
      value = { recordId: record.id, status: "none-found", renderNote: "No NeuroVault collection with this study's DOI was found. Only the text findings are available." };
    } else {
      const imgBody = await politeFetch(`${BASE}/collections/${col.id}/images/?format=json&limit=20`, { limiter, retries: 1, timeoutMs: 8_000, ...fetchOpts });
      const imgs: any[] = JSON.parse(imgBody)?.results ?? [];
      value = {
        recordId: record.id,
        status: "available",
        collection: {
          id: col.id,
          name: String(col.name ?? "Untitled collection"),
          url: `https://neurovault.org/collections/${col.id}/`,
          doi: record.doi,
        },
        images: imgs
          .filter((i) => typeof i?.id === "number")
          .map((i) => ({
            id: i.id,
            name: String(i.name ?? `Image ${i.id}`),
            url: `https://neurovault.org/images/${i.id}/`,
            mapType: i.map_type ? String(i.map_type) : undefined,
            modality: i.modality ? String(i.modality) : undefined,
            template: i.target_template_image ? String(i.target_template_image) : undefined,
            cognitiveParadigm: i.cognitive_paradigm_cogatlas ? String(i.cognitive_paradigm_cogatlas) : undefined,
          })),
        renderNote: SCHEMATIC_RENDER_NOTE,
      };
    }
    cache.set(record.doi, { at: Date.now(), value });
    return value;
  } catch (err) {
    return { recordId: record.id, status: "error", renderNote: "NeuroVault could not be checked right now.", error: (err as Error).message };
  }
}
