// Server-side Claude API call. The API key is read from the environment here
// and never leaves the server.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "../config.js";
import { REGIONS } from "../../shared/regions.js";
import { SOURCE_INFO, type CharacterProfile, type ExtractedIntent, type PopulationMatch, type ResearchRecord, type WebSource } from "../../shared/types.js";
import type { BrainRegion } from "../../shared/regions.js";
import { personNoun } from "../../shared/lifeStage.js";
import { ModelAnswerSchema, type ModelAnswer } from "./schema.js";

export class AiError extends Error {
  constructor(message: string, public readonly userMessage: string) {
    super(message);
    this.name = "AiError";
  }
}

const SYSTEM_PROMPT = `You are the research engine inside Brain Explorer, an educational neuroscience tool for students. Students explore the brain of a fictional character and ask what research says happens in a brain like his. You explain what published research does and does not show, using only the material supplied in each request.

Evidence rules:
- Base every statement on the supplied <record> studies. Cite them by exact id (for example "pmid:12345678"). Do not cite, name or describe any study that is not supplied, even if you know of it.
- <page> entries are excerpts from trusted websites (government health agencies, universities, journals). Cite them by id (for example "web:2"). Use only what the excerpts say. They are secondary to <record> studies: when studies exist, lead with the studies; when a sentence relies only on a web page, word it as what that source says (for example "the NIH says…").
- <background> entries are short textbook overviews of brain regions. You may use them to explain anatomy in plain words, citing their id (for example "region:hippocampus") with claimType "textbook-background". They are never evidence for a research finding.
- Abstracts are all you have. If a detail (sample size, effect size, population, method) is not in a record, do not supply it from memory.
- Separate what authors reported ("reported-finding") from your synthesis across studies ("interpretation"), proposed explanations ("hypothesis") and unanswered questions ("open-question").
- Be precise about evidence strength: correlation vs causation; behavioral vs structural MRI vs functional MRI vs connectivity vs EEG vs animal findings; reviews and meta-analyses vs new experiments. Brain activation does not show that a region uniquely causes a behavior.
- Keep disagreements visible under mixedOrContradictory instead of forcing a consensus.
- Records come from several databases (PubMed, Europe PMC, OpenAlex, Semantic Scholar). Preprints have not been peer reviewed: if you rely on one, say so in that sentence, and prefer peer-reviewed evidence when both exist.
- No invented numbers, coordinates, effect sizes or percentages.
- If the records do not actually address the question, set status to "insufficient-evidence", say what is missing, and leave mainFindings and studentExplanation empty.

The character:
- The character is fictional. His brain stands for what research suggests typically happens in people like him; it is not a real scan. Write "research suggests that in people his age…" rather than "his brain definitely does…". Never present group averages as certain facts about him.
- Each record says how well its population matches him (age group, species). When the best evidence comes from a different age group or from animals, say so in the paragraph that relies on it.
- This tool does not diagnose. If a situation involves possible harm (for example a head injury), add one sentence that a real person should talk to a doctor.

Hormones:
- Discuss hormones only when the request says hormones were asked about; otherwise return an empty hormones array and do not bring them up.

Writing:
- studentExplanation is the heart of the answer: 2–5 short paragraphs in a logical order (what changes first, what follows), 2–3 sentences each, plain words a 14-year-old can follow, specific about brain regions and processes, and every paragraph cited.
- Define scientific terms in keyTerms. No hype, no filler.
- For regions, use only these ids, and only for regions a cited study itself reports results about: ${REGIONS.map((r) => r.id).join(", ")}.`;

function formatRecord(r: ResearchRecord, match?: PopulationMatch): string {
  const authors = r.authors
    .slice(0, 3)
    .map((a) => a.collective ?? `${a.lastName ?? ""} ${a.foreName?.[0] ?? ""}`.trim())
    .join(", ");
  const abstract = r.abstract.map((s) => (s.label ? `${s.label}: ${s.text}` : s.text)).join("\n") || "(no abstract available)";
  return [
    `<record id="${r.id}">`,
    `Title: ${r.title}`,
    `Authors: ${authors}${r.authors.length > 3 ? " et al." : ""}`,
    `Journal / year: ${r.journal ?? "not reported"} / ${r.publicationYear ?? "not reported"}`,
    `Found in: ${(r.foundIn ?? [r.source]).map((id) => SOURCE_INFO[id]?.name ?? id).join(", ")}`,
    `Publication type: ${r.publicationTypes.join(", ") || "not reported"}${r.peerReview?.value === "preprint" ? " — PREPRINT, not peer reviewed" : ""}`,
    `Species (MeSH): ${r.species.value.join(", ") || "not indexed"}`,
    `Age groups (MeSH): ${r.ageGroups.value.join(", ") || "not indexed"}`,
    ...(match ? [`Match with the character: ${match.note}`] : []),
    `Abstract:\n${abstract}`,
    `</record>`,
  ].join("\n");
}

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(config.anthropicApiKey);
}

export interface SynthesisExtras {
  character?: CharacterProfile;
  background?: BrainRegion[];
  populationMatch?: Record<string, PopulationMatch>;
  webSources?: WebSource[];
}

export async function synthesizeAnswer(
  question: string,
  intent: ExtractedIntent,
  evidence: ResearchRecord[],
  extras: SynthesisExtras = {},
): Promise<{ answer: ModelAnswer; model: string }> {
  if (!config.anthropicApiKey) throw new AiError("No API key", "The AI engine is not configured.");
  client ??= new Anthropic({ apiKey: config.anthropicApiKey, timeout: 120_000, maxRetries: 2 });

  // Only the question and public study records are sent — no personal data.
  const { character, background = [], populationMatch = {}, webSources = [] } = extras;
  const userContent = [
    character
      ? `<character>Name: ${character.name}. A fictional ${character.age}-year-old ${personNoun(character.age)}. Answer about what research suggests happens in a brain like his.</character>`
      : "<character>None — answer the question in general terms.</character>",
    `<question>${question}</question>`,
    `<request>Task: ${intent.task}. Hormones asked about: ${intent.includeHormones ? "yes" : "no"}. ${intent.interpretationNotes.join(" ")}</request>`,
    `<background count="${background.length}">`,
    ...background.map((r) => `<entry id="region:${r.id}">${r.name}: ${r.overview} Commonly studied in relation to: ${r.commonlyStudiedIn.join(", ")}.</entry>`),
    `</background>`,
    `<evidence count="${evidence.length}">`,
    ...evidence.map((r) => formatRecord(r, populationMatch[r.id])),
    `</evidence>`,
    `<web count="${webSources.length}">`,
    ...webSources.map(
      (w) =>
        `<page id="${w.id}" site="${w.domain}" kind="${w.kind}"${w.pageAge ? ` date="${w.pageAge}"` : ""}>\nTitle: ${w.title}\nExcerpts (verbatim from the page):\n${w.excerpts.map((e) => `- ${e}`).join("\n")}\n</page>`,
    ),
    `</web>`,
  ].join("\n");

  try {
    const response = await client.beta.messages.parse({
      model: config.claudeModel,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      output_config: { effort: "high", format: zodOutputFormat(ModelAnswerSchema) },
      // If a safety classifier declines, let the API retry on its recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      throw new AiError("Model refusal", "The AI declined to answer this question. Try rephrasing it.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("Truncated", "The AI's answer was cut off before it finished. Please try again or narrow the question.");
    }
    const parsed = response.parsed_output ? ModelAnswerSchema.safeParse(response.parsed_output) : null;
    if (!parsed?.success) throw new AiError("Schema mismatch", "The AI returned an answer in an unexpected format.");
    return { answer: parsed.data, model: response.model };
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.AuthenticationError)
      throw new AiError("Auth failed", "The server's Claude API key was rejected. Check ANTHROPIC_API_KEY in .env.");
    if (err instanceof Anthropic.RateLimitError)
      throw new AiError("Rate limited", "The AI service is busy (rate limit). Please wait a minute and try again.");
    if (err instanceof Anthropic.APIConnectionError)
      throw new AiError("Connection failed", "Could not reach the AI service. Check the server's internet connection.");
    if (err instanceof Anthropic.APIError)
      throw new AiError(`API error ${err.status}`, "The AI service returned an error. Please try again.");
    throw new AiError(String(err), "Something went wrong while generating the answer.");
  }
}
