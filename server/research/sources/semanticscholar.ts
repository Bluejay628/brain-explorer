// Semantic Scholar Academic Graph API (Allen Institute for AI). Free; an API key is optional.
// Docs: https://api.semanticscholar.org/api-docs/graph
// Without a key, all anonymous users share a rate limit, so requests are spaced out
// and a failure here never blocks results from the other sources.

import type { Author, ResearchRecord, SearchFilters } from "../../../shared/types.js";
import { config } from "../../config.js";
import { buildRecord } from "../normalize.js";
import { ExternalApiError, politeFetch, RateLimiter, type FetchOptions } from "../http.js";
import type { SourceSearchResult } from "./types.js";

const BASE = "https://api.semanticscholar.org/graph/v1/paper/search";
const limiter = new RateLimiter(config.semanticScholarApiKey ? 1100 : 3000);
const FIELDS = "title,abstract,year,publicationDate,venue,journal,publicationTypes,externalIds,authors,url";
export const S2_FIELDS_OF_STUDY = "Medicine,Psychology,Biology";

const TYPE_MAP: Record<string, string> = {
  "meta-analysis": "MetaAnalysis",
  "systematic-review": "Review",
  review: "Review",
  "randomized-controlled-trial": "ClinicalTrial",
  "clinical-trial": "ClinicalTrial",
  "case-report": "CaseReport",
  "original-research": "JournalArticle",
};

export function normalizeSemanticScholar(p: any, retrievedAt = new Date().toISOString()): ResearchRecord | null {
  const title = String(p?.title ?? "").replace(/\s+/g, " ").trim();
  if (!title || !p?.paperId) return null;
  const ext = p.externalIds ?? {};
  const pmid = /^\d+$/.test(String(ext.PubMed ?? "")) ? String(ext.PubMed) : undefined;
  const doi = ext.DOI ? String(ext.DOI).toLowerCase() : undefined;
  const authors: Author[] = (p.authors ?? [])
    .map((a: any) => String(a?.name ?? "").trim())
    .filter(Boolean)
    .map((name: string) => {
      const parts = name.split(" ");
      return { fullName: name, lastName: parts.length > 1 ? parts[parts.length - 1] : name, foreName: parts.slice(0, -1).join(" ") || undefined };
    });
  const types: string[] = Array.isArray(p.publicationTypes) ? p.publicationTypes.map(String) : [];
  const venue = String(p.journal?.name ?? p.venue ?? "");
  const isPreprint = /arxiv|biorxiv|medrxiv|psyarxiv|research square|ssrn/i.test(venue) && !types.includes("JournalArticle");
  return buildRecord({
    id: pmid ? `pmid:${pmid}` : doi ? `doi:${doi}` : `s2:${String(p.paperId).toLowerCase()}`,
    pmid,
    doi,
    pmcid: ext.PubMedCentral ? `PMC${String(ext.PubMedCentral).replace(/^PMC/i, "")}` : undefined,
    title,
    authors,
    journal: venue || undefined,
    publicationDate: p.publicationDate ?? (p.year ? String(p.year) : undefined),
    publicationYear: Number(p.year) || undefined,
    abstract: p.abstract ? [{ text: String(p.abstract).replace(/\s+/g, " ").trim() }] : [],
    publicationTypes: types,
    meshTerms: [],
    keywords: [],
    sourceUrl: p.url ?? `https://www.semanticscholar.org/paper/${p.paperId}`,
    source: "semanticscholar",
    retrievedAt,
    isPreprint,
  });
}

export async function searchSemanticScholar(query: string, filters: SearchFilters = {}, limit = 12, fetchOpts: FetchOptions = {}): Promise<SourceSearchResult> {
  const q = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 200);
  const params = new URLSearchParams({ query: q, limit: String(Math.min(Math.max(limit, 1), 50)), fields: FIELDS, fieldsOfStudy: S2_FIELDS_OF_STUDY });
  if (filters.yearFrom || filters.yearTo) params.set("year", `${filters.yearFrom ?? ""}-${filters.yearTo ?? ""}`);
  const types = [...new Set((filters.categories ?? []).map((c) => TYPE_MAP[c]).filter(Boolean))];
  if (types.length) params.set("publicationTypes", types.join(","));
  const headers: Record<string, string> = config.semanticScholarApiKey ? { "x-api-key": config.semanticScholarApiKey } : {};
  const body = await politeFetch(`${BASE}?${params}`, { limiter, retries: 1, headers, ...fetchOpts });
  let json: any;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ExternalApiError("Semantic Scholar returned an unreadable response");
  }
  const data: any[] = json?.data ?? [];
  if (!Array.isArray(data)) throw new ExternalApiError("Semantic Scholar response was missing results");
  const now = new Date().toISOString();
  // Keep only papers with an abstract: without one there is nothing to inspect or cite.
  const records = data
    .map((p) => normalizeSemanticScholar(p, now))
    .filter((r): r is ResearchRecord => !!r && r.abstract.length > 0);
  return { records, total: Number(json.total) || records.length, query: `query="${q}" fieldsOfStudy=${S2_FIELDS_OF_STUDY}` };
}
