// The research workflow (retrieval-augmented generation):
//   question → intent → local library → PubMed (if needed) → dedupe + rank
//   → relevance check → Claude synthesis → citation validation → brain-map lookup

import type { BrainMapAvailability, ResearchAnswer, ResearchRecord } from "../../shared/types.js";
import type { Library } from "../research/library.js";
import { scoreRecord, tokenize } from "../research/library.js";
import { combinedSearch, type PubmedSearchFn } from "../research/search.js";
import { searchPubmed } from "../research/pubmed.js";
import { extractIntent } from "./intent.js";
import { AiError, isAiConfigured, synthesizeAnswer } from "./claude.js";
import { validateAnswer } from "./validate.js";
import { lookupBrainMaps } from "../maps/neurovault.js";
import type { ModelAnswer } from "./schema.js";

export const MAX_EVIDENCE = 8;
/** A record must contain at least this share of the topic's key terms to count as relevant. */
export const MIN_RELEVANCE = 0.6;
const ENOUGH_LOCAL = 5;

export interface EngineDeps {
  library: Library;
  pubmed?: PubmedSearchFn;
  synthesize?: typeof synthesizeAnswer;
  aiConfigured?: () => boolean;
  brainMaps?: (r: ResearchRecord) => Promise<BrainMapAvailability>;
}

export interface AskOptions {
  question: string;
  selectedRegionId?: string;
  allowPubMed?: boolean;
}

export async function answerQuestion(opts: AskOptions, deps: EngineDeps): Promise<ResearchAnswer> {
  const { library } = deps;
  const intent = extractIntent(opts.question, { selectedRegionId: opts.selectedRegionId });
  const topicTokens = tokenize(intent.topic);

  // 1) Local library first; 2) PubMed only if the library lacks enough relevant evidence.
  const localOnly = await combinedSearch(library, { query: intent.topic, filters: intent.filters, includePubMed: false, limit: 20 });
  const relevantLocal = localOnly.results.filter((r) => scoreRecord(r, topicTokens).coverage >= MIN_RELEVANCE);
  let search = localOnly;
  if (relevantLocal.length < ENOUGH_LOCAL && opts.allowPubMed !== false) {
    search = await combinedSearch(
      library,
      { query: intent.topic, filters: intent.filters, includePubMed: true, limit: 20 },
      deps.pubmed ?? searchPubmed,
    );
  }

  // 3) Rank everything by how well it matches the topic; keep the best few.
  const ranked = search.results
    .map((r) => scoreRecord(r, topicTokens))
    .filter((s) => s.coverage >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVIDENCE)
    .map((s) => s.record);

  const base: ResearchAnswer = {
    status: "insufficient-evidence",
    question: opts.question,
    intent,
    directAnswer: "",
    mainFindings: [],
    mixedOrContradictory: [],
    limitations: [],
    uncertainty: "",
    supportingStudies: [],
    regions: [],
    evidence: ranked,
    coverage: search.coverage,
    brainMaps: [],
    validationNotes: [],
    generatedAt: new Date().toISOString(),
  };

  // 4) No relevant studies → say so honestly, without calling the AI.
  if (!ranked.length) {
    const pubmed = search.coverage.find((c) => c.source === "pubmed");
    const pubmedNote = pubmed?.searched
      ? "PubMed was also searched."
      : pubmed?.error
        ? `PubMed could not be searched (${pubmed.error}).`
        : "PubMed was not searched.";
    return {
      ...base,
      directAnswer: `Brain Explorer could not find studies that clearly address this question. The local library was searched. ${pubmedNote} This does not mean the effect doesn't exist — only that no matching evidence was retrieved.`,
      uncertainty: "Without retrieved studies, no evidence-based answer can be given. Try different wording, remove filters, or search the Research Library directly.",
    };
  }

  // 5) AI not configured → show the evidence without a synthesis.
  if (!(deps.aiConfigured ?? isAiConfigured)()) {
    return {
      ...base,
      status: "retrieval-only",
      directAnswer:
        "The AI summary is turned off because no Claude API key is configured on the server. The studies below were retrieved for your question — open each one to read its abstract and original source.",
    };
  }

  // 6) Synthesis + 7) validation.
  let modelAnswer: ModelAnswer;
  let model: string;
  try {
    ({ answer: modelAnswer, model } = await (deps.synthesize ?? synthesizeAnswer)(opts.question, intent, ranked));
  } catch (err) {
    const message = err instanceof AiError ? err.userMessage : "The AI summary failed.";
    return { ...base, status: "ai-error", directAnswer: `${message} The retrieved studies are still listed below.` };
  }
  const validated = validateAnswer(modelAnswer, ranked);

  // 8) Brain maps: checked by the server from NeuroVault, never asserted by the AI.
  const cited = new Set([
    ...validated.supportingStudies.map((s) => s.recordId),
    ...validated.mainFindings.flatMap((c) => c.citations),
  ]);
  const toCheck = ranked.filter((r) => cited.has(r.id) && r.methods.value.some((m) => m.endsWith("mri") || m === "pet"));
  const brainMaps = await Promise.all(toCheck.slice(0, 4).map((r) => (deps.brainMaps ?? lookupBrainMaps)(r)));

  return { ...base, ...validated, brainMaps, model, generatedAt: new Date().toISOString() };
}
