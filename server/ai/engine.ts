// The research workflow (retrieval-augmented generation):
//   question → intent (+ character) → local library → PubMed (age-matched + general, if needed)
//   → dedupe + rank (age-matched studies first) → relevance check → Claude synthesis
//   → citation validation → brain-map lookup

import type { BrainMapAvailability, CharacterProfile, PopulationMatch, ResearchAnswer, ResearchRecord, SourceCoverage, SourceId, WebSource } from "../../shared/types.js";
import { REGION_BY_ID, type BrainRegion } from "../../shared/regions.js";
import { SOURCE_INFO } from "../../shared/types.js";
import type { Library } from "../research/library.js";
import { scoreRecord, tokenize } from "../research/library.js";
import { combinedSearch } from "../research/search.js";
import { DEFAULT_SOURCES, searchSources, type SourceRegistry } from "../research/sources/index.js";
import type { SourceSearchFn } from "../research/sources/types.js";
import { dedupeRecords } from "../research/dedupe.js";
import { extractIntent } from "./intent.js";
import { AiError, isAiConfigured, synthesizeAnswer } from "./claude.js";
import { searchTrustedWeb } from "./web.js";
import { validateAnswer } from "./validate.js";
import { ageGroupForAge, populationMatch } from "./neuro.js";
import { lookupBrainMaps } from "../maps/neurovault.js";
import type { ModelAnswer } from "./schema.js";

export const MAX_EVIDENCE = 10;
/** A record must contain at least this share of the topic's key terms to count as relevant. */
export const MIN_RELEVANCE = 0.6;
const ENOUGH_LOCAL = 5;
const ENOUGH_AGE_MATCHED = 3;
/** Search trusted websites only when fewer than this many relevant studies were found. */
export const WEB_SEARCH_BELOW = 4;

export interface EngineDeps {
  library: Library;
  pubmed?: SourceSearchFn;
  sources?: SourceRegistry;
  synthesize?: typeof synthesizeAnswer;
  aiConfigured?: () => boolean;
  brainMaps?: (r: ResearchRecord) => Promise<BrainMapAvailability>;
  webSearch?: typeof searchTrustedWeb;
}

export interface AskOptions {
  question: string;
  selectedRegionId?: string;
  allowPubMed?: boolean;
  character?: CharacterProfile;
  includeHormones?: boolean;
  focus?: string;
  /** Which external databases to search (default: all). */
  sources?: SourceId[];
  /** Search trusted websites when studies are thin (default: true). */
  allowWeb?: boolean;
}

export async function answerQuestion(opts: AskOptions, deps: EngineDeps): Promise<ResearchAnswer> {
  const { library } = deps;
  // Tests can inject sources; `pubmed` alone is accepted for older tests.
  const registry: SourceRegistry = deps.sources ?? (deps.pubmed ? { pubmed: deps.pubmed } : DEFAULT_SOURCES);
  const character = opts.character;
  const intent = extractIntent(opts.question, { selectedRegionId: opts.selectedRegionId, character, includeHormones: opts.includeHormones, focus: opts.focus });
  const query = intent.scientificTopic;
  const topicTokens = [...new Set([...tokenize(intent.scientificTopic)])];
  const group = character ? ageGroupForAge(character.age) : undefined;
  const matchOf = (r: ResearchRecord): PopulationMatch | undefined => (group && character ? populationMatch(r, group, character.name) : undefined);
  const isRelevant = (r: ResearchRecord) => scoreRecord(r, topicTokens).coverage >= MIN_RELEVANCE;

  // 1) Local library first.
  const local = await combinedSearch(library, { query, filters: intent.filters, includePubMed: false, limit: 30 });
  let results = local.results;
  const coverage: SourceCoverage[] = local.coverage.filter((c) => c.source === "local-library");
  const relevantLocal = results.filter(isRelevant);
  const ageMatchedLocal = relevantLocal.filter((r) => matchOf(r)?.age === "same-age-group");

  // 2) External databases when the library lacks enough relevant (or age-matched) evidence.
  //    All enabled sources are searched in parallel; age-matched searches only where the
  //    source has age indexing (PubMed, Europe PMC).
  const needExternal = relevantLocal.length < ENOUGH_LOCAL || (group !== undefined && ageMatchedLocal.length < ENOUGH_AGE_MATCHED);
  if (needExternal && opts.allowPubMed !== false) {
    const filters = { ...intent.filters, neuroFocus: true };
    const runs: { filters: typeof filters; onlyAgeCapable?: boolean }[] = [{ filters }];
    if (group && !intent.filters.ageGroups) runs.unshift({ filters: { ...filters, ageGroups: [group] }, onlyAgeCapable: true });
    const ext = await searchSources(registry, opts.sources, query, runs, 12);
    if (ext.records.length) library.upsert(ext.records);
    coverage.push(...ext.coverage);
    results = dedupeRecords([...results, ...ext.records]);
  } else {
    for (const id of Object.keys(registry) as SourceId[]) {
      if (!opts.sources || opts.sources.includes(id)) coverage.push({ source: id, searched: false, resultCount: 0 });
    }
  }

  // 3) Rank: relevance, with a boost for studies of the character's age group and for human studies.
  //    A search word that appears in NONE of the retrieved studies (a typo, a nickname) carries no
  //    information, so it is ignored — as long as at least half of the words remain.
  const informative = topicTokens.filter((t) => results.some((r) => scoreRecord(r, [t]).coverage > 0));
  const rankTokens = informative.length && informative.length >= Math.ceil(topicTokens.length / 2) ? informative : topicTokens;
  if (rankTokens.length < topicTokens.length) {
    const ignored = topicTokens.filter((t) => !rankTokens.includes(t));
    intent.interpretationNotes.push(`Ignored word(s) that appear in no retrieved study: ${ignored.map((w) => `"${w}"`).join(", ")}.`);
  }
  const ranked = results
    .map((r) => {
      const s = scoreRecord(r, rankTokens);
      const m = matchOf(r);
      const boost = (m?.age === "same-age-group" ? 1.35 : 1) * (m?.species === "animal" ? 0.8 : 1);
      return { r, coverage: s.coverage, score: s.score * boost };
    })
    .filter((s) => s.coverage >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVIDENCE)
    .map((s) => s.r);

  const populationMatches: Record<string, PopulationMatch> = {};
  for (const r of ranked) {
    const m = matchOf(r);
    if (m) populationMatches[r.id] = m;
  }

  const base: ResearchAnswer = {
    status: "insufficient-evidence",
    question: opts.question,
    intent,
    directAnswer: "",
    studentExplanation: [],
    hormones: [],
    keyTerms: [],
    confidence: { level: "insufficient", reason: "" },
    mainFindings: [],
    mixedOrContradictory: [],
    limitations: [],
    uncertainty: "",
    supportingStudies: [],
    regions: [],
    character: character && group ? { ...character, ageGroup: group } : undefined,
    populationMatch: populationMatches,
    background: [],
    evidence: ranked,
    webSources: [],
    coverage,
    brainMaps: [],
    validationNotes: [],
    generatedAt: new Date().toISOString(),
  };

  // 4) Thin evidence → search trusted websites (needs the AI engine, which runs the search).
  const aiOn = (deps.aiConfigured ?? isAiConfigured)();
  let webSources: WebSource[] = [];
  if (aiOn && opts.allowWeb !== false && ranked.length < WEB_SEARCH_BELOW) {
    try {
      webSources = await (deps.webSearch ?? searchTrustedWeb)(opts.question, intent);
      coverage.push({ source: "web", searched: true, query: `${intent.scientificTopic} (trusted sites only)`, resultCount: webSources.length });
    } catch (err) {
      coverage.push({ source: "web", searched: false, resultCount: 0, error: err instanceof AiError ? err.userMessage : (err as Error).message });
    }
  } else if (opts.allowWeb !== false) {
    coverage.push({ source: "web", searched: false, resultCount: 0, ...(aiOn ? {} : { error: "needs the AI engine (add ANTHROPIC_API_KEY)" }) });
  }
  base.webSources = webSources;

  // 5) No relevant studies or web pages → say so honestly, without calling the AI.
  if (!ranked.length && !webSources.length) {
    const ext = coverage.filter((c) => c.source !== "local-library");
    const label = (c: SourceCoverage) => (c.source === "web" ? "trusted websites" : SOURCE_INFO[c.source as SourceId].name);
    const searched = ext.filter((c) => c.searched).map(label);
    const failed = ext.filter((c) => !c.searched && c.error).map((c) => `${label(c)} (${c.error})`);
    const pubmedNote = [
      searched.length ? `Also searched: ${searched.join(", ")}.` : "No online databases were searched.",
      failed.length ? `Could not be searched: ${failed.join("; ")}.` : "",
    ].join(" ").trim();
    return {
      ...base,
      directAnswer: `Brain Explorer could not find studies that clearly address this question. The local library was searched. ${pubmedNote} This does not mean the effect doesn't exist — only that no matching evidence was retrieved.`,
      uncertainty: "Without retrieved studies, no evidence-based answer can be given. Try different wording, remove filters, or search the Research Library directly.",
      confidence: { level: "insufficient", reason: "No relevant studies were retrieved." },
    };
  }

  // 6) AI not configured → show the evidence without a synthesis.
  if (!aiOn) {
    return {
      ...base,
      status: "retrieval-only",
      directAnswer:
        "The AI summary is turned off because no Claude API key is configured on the server. The studies below were retrieved for your question — open each one to read its abstract and original source.",
    };
  }

  // 6) Textbook background: regions named in the question, the most-mentioned regions in the evidence,
  //    and hormone glands when hormones were asked about.
  const backgroundRegions = pickBackground(intent.regions, ranked, intent.includeHormones);

  let modelAnswer: ModelAnswer;
  let model: string;
  try {
    ({ answer: modelAnswer, model } = await (deps.synthesize ?? synthesizeAnswer)(opts.question, intent, ranked, {
      character,
      background: backgroundRegions,
      populationMatch: populationMatches,
      webSources,
    }));
  } catch (err) {
    const message = err instanceof AiError ? err.userMessage : "The AI summary failed.";
    return { ...base, status: "ai-error", directAnswer: `${message} The retrieved studies are still listed below.` };
  }

  // 7) Validation.
  const validated = validateAnswer(modelAnswer, ranked, {
    backgroundIds: backgroundRegions.map((r) => `region:${r.id}`),
    webSources,
    includeHormones: intent.includeHormones,
  });

  // 8) Brain maps: checked by the server from NeuroVault, never asserted by the AI.
  const cited = new Set([
    ...validated.supportingStudies.map((s) => s.recordId),
    ...validated.mainFindings.flatMap((c) => c.citations),
    ...validated.studentExplanation.flatMap((c) => c.citations),
  ]);
  const toCheck = ranked.filter((r) => cited.has(r.id) && r.methods.value.some((m) => m.endsWith("mri") || m === "pet"));
  const brainMaps = await Promise.all(toCheck.slice(0, 4).map((r) => (deps.brainMaps ?? lookupBrainMaps)(r)));

  return {
    ...base,
    ...validated,
    background: backgroundRegions.map((r) => ({ id: `region:${r.id}`, name: r.name })),
    brainMaps,
    model,
    generatedAt: new Date().toISOString(),
  };
}

function pickBackground(regionIds: string[], evidence: ResearchRecord[], hormones: boolean): BrainRegion[] {
  const counts = new Map<string, number>();
  for (const r of evidence) for (const id of r.regionsMentioned.value) counts.set(id, (counts.get(id) ?? 0) + 1);
  const frequent = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const ids = [...regionIds, ...frequent.slice(0, 6), ...(hormones ? ["hypothalamus", "pituitary-gland", "pineal-gland"] : [])];
  return [...new Set(ids)].map((id) => REGION_BY_ID.get(id)).filter((r): r is BrainRegion => !!r).slice(0, 10);
}
