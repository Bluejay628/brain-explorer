import { z } from "zod";

// The exact JSON shape Claude must return. The API's structured-outputs
// feature enforces this shape, and we re-validate it with zod on our side.

const ClaimType = z
  .enum(["reported-finding", "interpretation", "hypothesis", "open-question", "textbook-background"])
  .describe(
    "reported-finding = what a cited study's authors reported; interpretation = your synthesis across studies; hypothesis = a proposed explanation; open-question = not yet known; textbook-background = general anatomy from a <background> entry.",
  );

const Citations = z
  .array(z.string())
  .describe('IDs from the provided <record> ("pmid:…") or <background> ("region:…") entries. Never anything else.');

const Claim = z.object({
  text: z.string().describe("One statement, in plain language."),
  citations: Citations,
  claimType: ClaimType,
});

export const ModelAnswerSchema = z.object({
  status: z.enum(["answered", "insufficient-evidence"]),
  directAnswer: z.string().describe("2–3 sentences answering the question as far as the evidence allows."),
  studentExplanation: z
    .array(
      Claim.extend({
        heading: z.string().describe("3–6 word heading, e.g. 'Memory gets harder'."),
      }),
    )
    .describe("2–5 short paragraphs (2–3 sentences each) explaining, in order, what research suggests happens in the brain. Plain language a 14-year-old can follow. Every paragraph cites."),
  hormones: z
    .array(z.object({ hormone: z.string(), role: z.string().describe("1–2 sentences."), citations: Citations }))
    .describe("Only if the request says hormones were asked about; otherwise an empty array."),
  keyTerms: z
    .array(z.object({ term: z.string(), definition: z.string().describe("One short sentence.") }))
    .describe("2–5 scientific terms used above, defined simply."),
  confidence: z.object({
    level: z.enum(["strong", "moderate", "limited", "insufficient"]),
    reason: z.string().describe("One sentence: why, based on number, design and population of the studies."),
  }),
  mainFindings: z.array(Claim),
  mixedOrContradictory: z.array(Claim).describe("Findings that disagree across studies. Empty if none were found in the evidence."),
  limitations: z.array(z.string()).describe("Limitations of this evidence set (designs, samples, populations, measures)."),
  uncertainty: z.string().describe("What remains unknown or uncertain."),
  supportingStudies: z.array(
    z.object({
      recordId: z.string(),
      relevance: z.string().describe("Why this study is relevant to the question."),
      evidenceNote: z.string().describe("Design, population and what kind of evidence it provides (e.g., correlational fMRI in 30 young adults)."),
    }),
  ),
  regions: z
    .array(z.object({ name: z.string().describe("A region id from the allowed list."), citations: z.array(z.string()) }))
    .describe("Brain regions the cited studies themselves report results about. Empty if none."),
});

export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;
