import { z } from "zod";

// The exact JSON shape Claude must return. The API's structured-outputs
// feature enforces this shape, and we re-validate it with zod on our side.

const Claim = z.object({
  text: z.string().describe("One statement, in plain language."),
  citations: z.array(z.string()).describe('Record IDs from the provided evidence, e.g. "pmid:12345678". Never anything else.'),
  claimType: z
    .enum(["reported-finding", "interpretation", "hypothesis", "open-question"])
    .describe("reported-finding = what a study's authors reported; interpretation = your synthesis across studies."),
});

export const ModelAnswerSchema = z.object({
  status: z.enum(["answered", "insufficient-evidence"]),
  directAnswer: z.string().describe("2–4 sentences answering the question as far as the evidence allows."),
  mainFindings: z.array(Claim),
  mixedOrContradictory: z.array(Claim).describe("Findings that disagree or are inconsistent across studies. Empty if none were found in the evidence."),
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
