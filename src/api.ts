// Browser → server calls. The browser only ever talks to our own server (/api);
// the server talks to PubMed, NeuroVault and Claude. No keys live in this file.

import type { BrainMapAvailability, CharacterProfile, ResearchAnswer, ResearchRecord, SearchRequest, SearchResponse, ServerStatus, SourceId } from "../shared/types";

export class ApiError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError("Could not reach the Brain Explorer server. Is it running (npm run dev)?");
  }
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) throw new ApiError(body?.error ?? `Request failed (HTTP ${res.status}).`);
  return body as T;
}

export const api = {
  status: () => call<ServerStatus>("/api/status"),
  search: (req: SearchRequest) => call<SearchResponse>("/api/search", { method: "POST", body: JSON.stringify(req) }),
  study: (id: string) => call<ResearchRecord>(`/api/studies/${encodeURIComponent(id)}`),
  maps: (id: string) => call<BrainMapAvailability>(`/api/studies/${encodeURIComponent(id)}/maps`),
  ask: (question: string, opts: { selectedRegionId?: string; allowPubMed?: boolean; character?: CharacterProfile; includeHormones?: boolean; focus?: string; sources?: SourceId[]; allowWeb?: boolean }) =>
    call<ResearchAnswer>("/api/ask", { method: "POST", body: JSON.stringify({ question, ...opts }) }),
};
