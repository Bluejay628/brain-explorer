// Combined search: local library first, then (optionally) PubMed live.
// Reports exactly which sources were searched and what each returned, so the
// UI and the AI never claim a source was searched when it wasn't.

import type { ResearchRecord, SearchFilters, SourceCoverage } from "../../shared/types.js";
import type { Library } from "./library.js";
import { dedupeRecords } from "./dedupe.js";
import { searchPubmed } from "./pubmed.js";

export interface CombinedSearchOptions {
  query: string;
  /** Plain-text query for PubMed; defaults to `query`. */
  pubmedQuery?: string;
  filters?: SearchFilters;
  includePubMed?: boolean;
  limit?: number;
}

export type PubmedSearchFn = typeof searchPubmed;

export async function combinedSearch(
  library: Library,
  opts: CombinedSearchOptions,
  pubmed: PubmedSearchFn = searchPubmed,
): Promise<{ results: ResearchRecord[]; coverage: SourceCoverage[] }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const filters = opts.filters ?? {};
  const local = library.search(opts.query, filters, limit);
  const coverage: SourceCoverage[] = [
    { source: "local-library", searched: true, query: opts.query, resultCount: local.length, totalAvailable: library.size },
  ];
  let pubmedRecords: ResearchRecord[] = [];

  if (opts.includePubMed) {
    try {
      const pm = await pubmed(opts.pubmedQuery ?? opts.query, filters, Math.min(limit, 20));
      pubmedRecords = pm.records;
      coverage.push({ source: "pubmed", searched: true, query: pm.query, resultCount: pm.records.length, totalAvailable: pm.total });
      // Cache what we retrieved so it is available offline and inspectable later.
      library.upsert(pm.records);
    } catch (err) {
      coverage.push({ source: "pubmed", searched: false, resultCount: 0, error: (err as Error).message });
    }
  } else {
    coverage.push({ source: "pubmed", searched: false, resultCount: 0 });
  }

  const results = dedupeRecords([...local.map((s) => s.record), ...pubmedRecords]).slice(0, limit);
  return { results, coverage };
}
