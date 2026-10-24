// Server-side Claude API call. The API key is read from the environment here
// and never leaves the server.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "../config.js";
import { REGIONS } from "../../shared/regions.js";
import type { ExtractedIntent, ResearchRecord } from "../../shared/types.js";
import { ModelAnswerSchema, type ModelAnswer } from "./schema.js";

export class AiError extends Error {
  constructor(message: string, public readonly userMessage: string) {
    super(message);
    this.name = "AiError";
  }
}

const SYSTEM_PROMPT = `You are the research engine inside Brain Explorer, an educational neuroscience tool used by students and the public. You explain what published research does and does not show, using only the study records supplied in each request.

How to work:
- Base every statement on the supplied records. Cite records by their exact id (for example "pmid:12345678") in the citations array. Do not cite, name or describe any study that is not in the supplied records, even if you know of it.
- Abstracts are all you have. If a detail (sample size, effect size, population, method) is not in a record, do not supply it from memory; say it is not reported in the abstract.
- Separate what authors reported ("reported-finding") from your synthesis across studies ("interpretation"), proposed explanations ("hypothesis"), and unanswered questions ("open-question").
- Be precise about evidence strength: distinguish correlation from causation; behavioral results from structural MRI, functional MRI, connectivity, EEG and animal findings; and reviews or meta-analyses from new experiments. Brain activation in a region does not show that the region uniquely causes a behavior.
- Keep disagreements visible. If studies conflict or results are mixed, list them under mixedOrContradictory rather than forcing a consensus.
- Mention sample and population limits when the records report them, and note when findings come from a narrow group (e.g., young adult university students) or from animals.
- Avoid unsupported precision: no invented numbers, coordinates, effect sizes or percentages.
- This tool does not diagnose or assess individuals. Group-level findings do not describe any particular person's brain; say so if the user asks about themselves.
- If the supplied records do not actually address the question, set status to "insufficient-evidence", explain what is missing in directAnswer and uncertainty, and leave mainFindings empty.
- For regions, use only these ids, and only for regions that a cited study itself reports results about: ${REGIONS.map((r) => r.id).join(", ")}.
- Write for a curious high-school reader: clear, plain language, no hype.`;

function formatRecord(r: ResearchRecord): string {
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
    `Publication type (PubMed): ${r.publicationTypes.join(", ") || "not reported"}`,
    `Species (MeSH): ${r.species.value.join(", ") || "not indexed"}`,
    `Age groups (MeSH): ${r.ageGroups.value.join(", ") || "not indexed"}`,
    `Abstract:\n${abstract}`,
    `</record>`,
  ].join("\n");
}

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(config.anthropicApiKey);
}

export async function synthesizeAnswer(
  question: string,
  intent: ExtractedIntent,
  evidence: ResearchRecord[],
): Promise<{ answer: ModelAnswer; model: string }> {
  if (!config.anthropicApiKey) throw new AiError("No API key", "The AI engine is not configured.");
  client ??= new Anthropic({ apiKey: config.anthropicApiKey, timeout: 120_000, maxRetries: 2 });

  // Only the question and public study records are sent — no personal data.
  const userContent = [
    `<question>${question}</question>`,
    `<interpretation>Task: ${intent.task}. ${intent.interpretationNotes.join(" ")}</interpretation>`,
    `<evidence count="${evidence.length}">`,
    ...evidence.map(formatRecord),
    `</evidence>`,
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
