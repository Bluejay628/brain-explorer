// Combined search: local library first, then (optionally) the external research
// databases live. Reports exactly which sources were searched and what each
// returned, so the UI and the AI never claim a source was searched when it wasn't.

import type { ResearchRecord, SearchFilters, SourceCoverage, SourceId } from "../../shared/types.js";
import type { Library } from "./library.js";
import { dedupeRecords } from "./dedupe.js";
import { searchSources, toRegistry, type SourceRegistry } from "./sources/index.js";
import type { SourceSearchFn } from "./sources/types.js";

export interface CombinedSearchOptions {
  query: string;
  filters?: SearchFilters;
  /** Search external databases live (otherwise local library only). */
  includePubMed?: boolean;
  /** Which external databases to search (default: all). */
  sources?: SourceId[];
  limit?: number;
}

/** @deprecated kept for older callers; any single source function works. */
export type PubmedSearchFn = SourceSearchFn;

export async function combinedSearch(
  library: Library,
  opts: CombinedSearchOptions,
  sources?: SourceRegistry | SourceSearchFn,
): Promise<{ results: ResearchRecord[]; coverage: SourceCoverage[] }> {
  const registry = toRegistry(sources);
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const filters = opts.filters ?? {};
  const local = library.search(opts.query, filters, limit);
  const coverage: SourceCoverage[] = [
    { source: "local-library", searched: true, query: opts.query, resultCount: local.length, totalAvailable: library.size },
  ];
  let external: ResearchRecord[] = [];

  if (opts.includePubMed) {
    const res = await searchSources(registry, opts.sources, opts.query, [{ filters }], Math.min(limit, 20));
    external = res.records;
    coverage.push(...res.coverage);
    // Cache what we retrieved so it is available offline and inspectable later.
    if (external.length) library.upsert(external);
  } else {
    for (const id of Object.keys(registry) as SourceId[]) coverage.push({ source: id, searched: false, resultCount: 0 });
  }

  const results = dedupeRecords([...local.map((s) => s.record), ...external]).slice(0, limit);
  return { results, coverage };
}
