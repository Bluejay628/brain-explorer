// OpenAlex API. Free, no key ("polite pool" with a contact email).
// Docs: https://docs.openalex.org/
// Indexes ~250M scholarly works from all publishers. We restrict it to the
// Medicine (27), Neuroscience (28) and Psychology (32) fields and to works
// with an abstract, so results stay on-topic and inspectable.

import type { Author, ResearchRecord, SearchFilters } from "../../../shared/types.js";
import { config } from "../../config.js";
import { buildRecord } from "../normalize.js";
import { ExternalApiError, politeFetch, RateLimiter, type FetchOptions } from "../http.js";
import type { SourceSearchResult } from "./types.js";

const BASE = "https://api.openalex.org/works";
const limiter = new RateLimiter(150);
export const OPENALEX_FIELDS = "27|28|32"; // Medicine | Neuroscience | Psychology

/** OpenAlex stores abstracts as {word: [positions]}; rebuild the text. */
export function rebuildAbstract(index: Record<string, number[]> | null | undefined): string {
  if (!index || typeof index !== "object") return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const p of positions) if (Number.isInteger(p) && p >= 0 && p < 20000) words[p] = word;
  }
  return words.filter((w) => w !== undefined).join(" ").replace(/\s+/g, " ").trim();
}

export function buildOpenAlexFilter(f: SearchFilters = {}, withFields = true): string {
  const types = new Set<string>();
  for (const c of f.categories ?? []) {
    if (c === "review" || c === "systematic-review" || c === "meta-analysis") types.add("review");
    else if (c === "preprint") types.add("preprint");
    else types.add("article");
  }
  const parts = [
    "has_abstract:true",
    `type:${types.size ? [...types].join("|") : "article|review|preprint"}`,
    ...(withFields ? [`primary_topic.field.id:${OPENALEX_FIELDS}`] : []),
  ];
  if (f.yearFrom || f.yearTo) parts.push(`publication_year:${f.yearFrom ?? 1800}-${f.yearTo ?? 3000}`);
  return parts.join(",");
}

export function normalizeOpenAlex(w: any, retrievedAt = new Date().toISOString()): ResearchRecord | null {
  const title = String(w?.title ?? w?.display_name ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const openalexId = String(w?.id ?? "").split("/").pop();
  if (!title || !openalexId) return null;
  const doi = w.doi ? String(w.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() : undefined;
  const pmid = String(w.ids?.pmid ?? "").match(/(\d+)\/?$/)?.[1];
  const pmcid = String(w.ids?.pmcid ?? "").match(/(PMC\d+)/i)?.[1];
  const abstractText = rebuildAbstract(w.abstract_inverted_index);
  const authors: Author[] = (w.authorships ?? [])
    .map((a: any) => String(a?.author?.display_name ?? "").trim())
    .filter(Boolean)
    .map((name: string) => {
      const parts = name.split(" ");
      return { fullName: name, lastName: parts.length > 1 ? parts[parts.length - 1] : name, foreName: parts.slice(0, -1).join(" ") || undefined };
    });
  const type = String(w.type ?? "");
  const isPreprint = type === "preprint" || w.primary_location?.version === "submittedVersion";
  return buildRecord({
    id: pmid ? `pmid:${pmid}` : doi ? `doi:${doi}` : `openalex:${openalexId.toLowerCase()}`,
    pmid,
    doi,
    pmcid,
    title,
    authors,
    journal: w.primary_location?.source?.display_name ?? undefined,
    publicationDate: w.publication_date ?? (w.publication_year ? String(w.publication_year) : undefined),
    publicationYear: Number(w.publication_year) || undefined,
    abstract: abstractText ? [{ text: abstractText }] : [],
    publicationTypes: type ? [type] : [],
    meshTerms: [],
    keywords: (w.keywords ?? []).map((k: any) => String(k?.display_name ?? k)).filter(Boolean),
    sourceUrl: `https://openalex.org/${openalexId}`,
    source: "openalex",
    retrievedAt,
    isPreprint,
  });
}

export async function searchOpenAlex(query: string, filters: SearchFilters = {}, limit = 12, fetchOpts: FetchOptions = {}): Promise<SourceSearchResult> {
  const search = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  const filter = buildOpenAlexFilter(filters);
  const params = new URLSearchParams({ search, filter, "per-page": String(Math.min(Math.max(limit, 1), 50)) });
  if (config.contactEmail) params.set("mailto", config.contactEmail);
  let body: string;
  let usedFilter = filter;
  try {
    body = await politeFetch(`${BASE}?${params}`, { limiter, ...fetchOpts });
  } catch (err) {
    // If OpenAlex ever rejects the field filter (HTTP 400), retry once without it rather than failing.
    if (!(err instanceof ExternalApiError) || err.status !== 400) throw err;
    usedFilter = buildOpenAlexFilter(filters, false);
    params.set("filter", usedFilter);
    body = await politeFetch(`${BASE}?${params}`, { limiter, ...fetchOpts });
  }
  let json: any;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ExternalApiError("OpenAlex returned an unreadable response");
  }
  if (!Array.isArray(json?.results)) throw new ExternalApiError("OpenAlex response was missing results");
  const now = new Date().toISOString();
  const records = json.results.map((w: any) => normalizeOpenAlex(w, now)).filter((r: ResearchRecord | null): r is ResearchRecord => !!r);
  return { records, total: Number(json.meta?.count) || records.length, query: `search="${search}" filter=${usedFilter}` };
}
