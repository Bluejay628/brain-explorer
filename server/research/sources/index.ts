// Registry of external research databases, and a helper that searches several
// of them at once. Each source reports its own coverage (searched? how many?
// error?) so answers never claim a source was searched when it wasn't.

import { ALL_SOURCES, type ResearchRecord, type SearchFilters, type SourceCoverage, type SourceId } from "../../../shared/types.js";
import { searchPubmed } from "../pubmed.js";
import { searchEuropePmc } from "./europepmc.js";
import { searchOpenAlex } from "./openalex.js";
import { searchSemanticScholar } from "./semanticscholar.js";
import type { SourceSearchFn } from "./types.js";

export type SourceRegistry = Partial<Record<SourceId, SourceSearchFn>>;

export const DEFAULT_SOURCES: SourceRegistry = {
  pubmed: searchPubmed,
  europepmc: searchEuropePmc,
  openalex: searchOpenAlex,
  semanticscholar: searchSemanticScholar,
};

/** Accept either a full registry or (for older callers/tests) a single PubMed function. */
export function toRegistry(r?: SourceRegistry | SourceSearchFn): SourceRegistry {
  if (!r) return DEFAULT_SOURCES;
  return typeof r === "function" ? { pubmed: r } : r;
}

export interface MultiSearchResult {
  records: ResearchRecord[];
  coverage: SourceCoverage[];
}

/**
 * Search the chosen sources in parallel. `runs` lets a caller search the same
 * source twice (e.g. age-matched first, then general); results are combined.
 */
export async function searchSources(
  registry: SourceRegistry,
  enabled: SourceId[] | undefined,
  query: string,
  runs: { filters: SearchFilters; onlyAgeCapable?: boolean }[],
  limit: number,
): Promise<MultiSearchResult> {
  const ids = (enabled ?? ALL_SOURCES).filter((id) => registry[id]);
  const perSource = await Promise.all(
    ids.map(async (id) => {
      const fn = registry[id]!;
      const found: ResearchRecord[] = [];
      const queries: string[] = [];
      const errors: string[] = [];
      let total = 0;
      for (const run of runs) {
        if (run.onlyAgeCapable && !(id === "pubmed" || id === "europepmc")) continue;
        try {
          const res = await fn(query, run.filters, limit);
          found.push(...res.records);
          queries.push(res.query);
          total = Math.max(total, res.total);
        } catch (err) {
          errors.push((err as Error).message);
        }
      }
      const coverage: SourceCoverage = queries.length
        ? { source: id, searched: true, query: queries.join("  |  "), resultCount: found.length, totalAvailable: total, ...(errors.length ? { error: `partly failed: ${errors[0]}` } : {}) }
        : { source: id, searched: false, resultCount: 0, error: errors[0] ?? "not searched" };
      return { found, coverage };
    }),
  );
  return { records: perSource.flatMap((p) => p.found), coverage: perSource.map((p) => p.coverage) };
}
