// Web research with Claude's server-side web search tool, limited to trusted domains.
//
// Integrity rules:
//  - Only domains on TRUSTED_DOMAINS can be searched (enforced by the API's allowed_domains).
//  - A page becomes a WebSource only if the search tool returned verbatim text from it
//    (a "web_search_result_location" citation). Those excerpts are the ONLY page content
//    the synthesis step sees, so the final answer can't rely on things the page didn't say.
//  - URLs come from the search tool's results, never from the model's own writing.

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { ExtractedIntent, WebSource } from "../../shared/types.js";
import { AiError } from "./claude.js";

/** Reputable health, science and education sites (subdomains included). */
export const TRUSTED_DOMAINS = [
  // Government & public health
  "nih.gov", "cdc.gov", "medlineplus.gov", "fda.gov", "who.int", "nhs.uk", "nice.org.uk", "canada.ca", "health.gov.au",
  // Medical centers & professional societies
  "mayoclinic.org", "clevelandclinic.org", "hopkinsmedicine.org", "aap.org", "apa.org", "sfn.org", "brainfacts.org", "aasm.org", "sleepfoundation.org",
  // Journals & publishers
  "nature.com", "science.org", "cell.com", "thelancet.com", "nejm.org", "jamanetwork.com", "bmj.com", "sciencedirect.com", "springer.com", "wiley.com", "frontiersin.org", "plos.org", "pnas.org", "oup.com", "europepmc.org",
  // Universities
  "harvard.edu", "stanford.edu", "mit.edu", "yale.edu", "ox.ac.uk", "cam.ac.uk", "ucl.ac.uk", "berkeley.edu", "ucsf.edu",
];

const KIND: [RegExp, WebSource["kind"]][] = [
  [/(\.gov|\.gov\.\w+|who\.int|nhs\.uk|nice\.org\.uk|canada\.ca)$/, "government"],
  [/(\.edu|\.ac\.uk)$/, "university"],
  [/(nature|science|cell|thelancet|nejm|jamanetwork|bmj|sciencedirect|springer|wiley|frontiersin|plos|pnas|oup|europepmc)\.(com|org)$/, "journal"],
  [/(mayoclinic|clevelandclinic|hopkinsmedicine|aap|apa|sfn|brainfacts|aasm|sleepfoundation)\.org$/, "health-organization"],
];

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isTrusted(url: string): boolean {
  const host = domainOf(url);
  return TRUSTED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function kindOf(domain: string): WebSource["kind"] {
  return KIND.find(([re]) => re.test(domain))?.[1] ?? "other";
}

/**
 * Turn a web-search response into WebSources. Pure function (easy to test):
 * collects search results (title, url, date) and the verbatim excerpts cited from them.
 */
export function extractWebSources(content: any[], retrievedAt = new Date().toISOString(), max = 8): WebSource[] {
  const meta = new Map<string, { title: string; pageAge?: string }>();
  const excerpts = new Map<string, string[]>();
  for (const block of content ?? []) {
    if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r?.type === "web_search_result" && typeof r.url === "string") meta.set(r.url, { title: String(r.title ?? ""), pageAge: r.page_age ?? undefined });
      }
    }
    if (block?.type === "text" && Array.isArray(block.citations)) {
      for (const c of block.citations) {
        if (c?.type !== "web_search_result_location" || typeof c.url !== "string" || !c.cited_text) continue;
        const list = excerpts.get(c.url) ?? [];
        const text = String(c.cited_text).replace(/\s+/g, " ").trim();
        if (text && !list.includes(text)) list.push(text);
        excerpts.set(c.url, list);
        if (!meta.has(c.url)) meta.set(c.url, { title: String(c.title ?? "") });
      }
    }
  }
  const out: WebSource[] = [];
  for (const [url, ex] of excerpts) {
    if (!isTrusted(url) || !ex.length) continue; // no verbatim text or untrusted domain → not usable
    const domain = domainOf(url);
    const m = meta.get(url);
    out.push({
      id: `web:${out.length + 1}`,
      url,
      title: m?.title || domain,
      domain,
      kind: kindOf(domain),
      pageAge: m?.pageAge,
      excerpts: ex.slice(0, 4).map((e) => e.slice(0, 600)),
      retrievedAt,
    });
    if (out.length >= max) break;
  }
  return out;
}

let client: Anthropic | null = null;

export async function searchTrustedWeb(question: string, intent: ExtractedIntent): Promise<WebSource[]> {
  if (!config.anthropicApiKey) throw new AiError("No API key", "The AI engine is not configured.");
  client ??= new Anthropic({ apiKey: config.anthropicApiKey, timeout: 120_000, maxRetries: 2 });

  const prompt = [
    "Use web search to find what reliable scientific and health sources say about this neuroscience question.",
    "Prefer research summaries, government health pages and journal articles. Quote what the pages actually say.",
    "Write a short factual summary in which every sentence cites the page it came from. Do not add facts that are not on a page you found.",
    `Question: ${question}`,
    `Research terms: ${intent.scientificTopic}`,
  ].join("\n");

  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: prompt }];
  const content: any[] = [];
  // Server tools can pause long searches ("pause_turn"); resume up to twice.
  for (let i = 0; i < 3; i++) {
    const res = await client.beta.messages.create({
      model: config.claudeModel,
      max_tokens: 8000,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4, allowed_domains: TRUSTED_DOMAINS }],
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (res.stop_reason === "refusal") throw new AiError("Refusal", "The web search was declined. Try rephrasing the question.");
    content.push(...res.content);
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  return extractWebSources(content);
}
