import type { ResearchRecord, SearchFilters } from "../../../shared/types.js";
import type { FetchOptions } from "../http.js";

export interface SourceSearchResult {
  records: ResearchRecord[];
  /** Total matches the source reports. */
  total: number;
  /** The exact query sent, shown to users under "Search coverage". */
  query: string;
}

/** Every research database is searched through this same shape. */
export type SourceSearchFn = (query: string, filters?: SearchFilters, limit?: number, fetchOpts?: FetchOptions) => Promise<SourceSearchResult>;
