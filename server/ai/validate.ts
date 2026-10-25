// Citation validator — the last line of defence before an AI answer is shown.
//
// Every citation must point to a record that was actually retrieved for this
// question, a trusted web page the web search actually returned, or a textbook
// background entry that was actually supplied.
// Rules:
//  - Claims without any valid support are removed (and the removal is reported).
//  - A "reported finding" must cite at least one STUDY; if it only cites
//    textbook background it is relabeled as textbook background.
//  - Hormone notes are dropped unless the user asked about hormones.
//  - Brain regions must be real dictionary entries AND be mentioned (or have a
//    subdivision mentioned) in the studies cited for them.

import type { CitedClaim, HormoneNote, ResearchAnswer, ResearchRecord, StudentParagraph, StudyAssessment, WebSource } from "../../shared/types.js";
import { REGION_BY_ID, descendantsOf } from "../../shared/regions.js";
import type { ModelAnswer } from "./schema.js";

export interface ValidatedAnswer {
  status: "answered" | "insufficient-evidence";
  directAnswer: string;
  studentExplanation: StudentParagraph[];
  hormones: HormoneNote[];
  keyTerms: { term: string; definition: string }[];
  confidence: ResearchAnswer["confidence"];
  mainFindings: CitedClaim[];
  mixedOrContradictory: CitedClaim[];
  limitations: string[];
  uncertainty: string;
  supportingStudies: StudyAssessment[];
  regions: { name: string; citations: string[] }[];
  validationNotes: string[];
}

export interface ValidationContext {
  /** Background IDs ("region:<id>") that were supplied to the model. */
  backgroundIds?: string[];
  includeHormones?: boolean;
  /** Web pages actually returned by the trusted web search. */
  webSources?: WebSource[];
}

/** Normalize the citation formats a model might plausibly produce. */
export function normalizeCitation(c: string): string {
  const t = c.trim();
  const m = t.match(/^(?:pmid[:\s]*)?(\d{5,9})$/i);
  if (m) return `pmid:${m[1]}`;
  return t.toLowerCase();
}

export function validateAnswer(answer: ModelAnswer, evidence: ResearchRecord[], ctx: ValidationContext = {}): ValidatedAnswer {
  const studies = new Map(evidence.map((r) => [r.id, r]));
  const background = new Set(ctx.backgroundIds ?? []);
  const web = new Set((ctx.webSources ?? []).map((w) => w.id));
  /** Studies and web pages are evidence; textbook background is not. */
  const isEvidence = (c: string) => studies.has(c) || web.has(c);
  const isValid = (c: string) => isEvidence(c) || background.has(c);
  const notes: string[] = [];
  const invalidSeen = new Set<string>();

  const checkCitations = (citations: string[]) => {
    const normalized = [...new Set(citations.map(normalizeCitation))];
    normalized.filter((c) => !isValid(c)).forEach((c) => invalidSeen.add(c));
    return normalized.filter(isValid);
  };

  function checkClaims<T extends CitedClaim>(claims: T[], section: string): T[] {
    return claims.flatMap((claim) => {
      const valid = checkCitations(claim.citations);
      // Open questions may legitimately have no citation; everything else needs one.
      if (!valid.length && claim.claimType !== "open-question") {
        notes.push(`Removed an unsupported statement from "${section}" because it had no valid citation.`);
        return [];
      }
      let claimType = claim.claimType;
      const citesStudy = valid.some(isEvidence);
      if (!citesStudy && valid.length && (claimType === "reported-finding" || claimType === "interpretation")) {
        claimType = "textbook-background";
        notes.push(`Relabeled a statement in "${section}" as textbook background because it cited no study.`);
      }
      if (claimType === "textbook-background" && citesStudy && valid.every(isEvidence)) claimType = "interpretation";
      return [{ ...claim, citations: valid, claimType }];
    });
  }

  const studentExplanation = checkClaims(answer.studentExplanation, "What happens in the brain");
  const mainFindings = checkClaims(answer.mainFindings, "Main findings");
  const mixedOrContradictory = checkClaims(answer.mixedOrContradictory, "Mixed findings");

  let hormones: HormoneNote[] = [];
  if (ctx.includeHormones) {
    hormones = answer.hormones.flatMap((h) => {
      const valid = checkCitations(h.citations);
      if (!valid.length) {
        notes.push(`Removed the hormone note on "${h.hormone}" because it had no valid citation.`);
        return [];
      }
      return [{ ...h, citations: valid }];
    });
  } else if (answer.hormones.length) {
    notes.push("Hormone details were left out because you didn't ask about hormones.");
  }

  const supportingStudies = answer.supportingStudies
    .map((s) => ({ ...s, recordId: normalizeCitation(s.recordId) }))
    .filter((s) => {
      if (studies.has(s.recordId)) return true;
      invalidSeen.add(s.recordId);
      return false;
    });

  const regions = answer.regions.flatMap((r) => {
    const id = r.name.trim().toLowerCase().replace(/\s+/g, "-");
    const region = REGION_BY_ID.get(id);
    if (!region) {
      notes.push(`Removed region "${r.name}" because it is not in the app's region dictionary.`);
      return [];
    }
    const acceptable = new Set([id, ...descendantsOf(id).map((d) => d.id)]);
    const citations = r.citations
      .map(normalizeCitation)
      .filter((c) => studies.get(c)?.regionsMentioned.value.some((m) => acceptable.has(m)));
    if (!citations.length) {
      notes.push(`Removed region "${region.name}" because none of its cited studies mention it in their abstract.`);
      return [];
    }
    return [{ name: id, citations }];
  });

  // Free-text fields could still mention a PMID that wasn't retrieved — flag it.
  const freeText = [answer.directAnswer, answer.uncertainty, ...answer.limitations].join(" ");
  for (const m of freeText.matchAll(/\bPMID[:\s]*(\d{5,9})\b/gi)) {
    if (!studies.has(`pmid:${m[1]}`)) invalidSeen.add(`pmid:${m[1]}`);
  }
  if (invalidSeen.size) {
    notes.push(`The AI referenced ${invalidSeen.size} source(s) that were not in the retrieved evidence; those references were removed.`);
  }

  let status = answer.status;
  let directAnswer = answer.directAnswer;
  for (const bad of invalidSeen) {
    const pmid = bad.replace(/^pmid:/, "");
    if (/^\d+$/.test(pmid)) directAnswer = directAnswer.replace(new RegExp(`\\(?PMID[:\\s]*${pmid}\\)?`, "gi"), "[unverified reference removed]");
  }
  const hasStudySupport = [...mainFindings, ...studentExplanation].some((c) => c.citations.some(isEvidence));
  if (status === "answered" && !hasStudySupport) {
    status = "insufficient-evidence";
    notes.push("No statement in the AI answer was supported by a retrieved study, so it is shown as insufficient evidence.");
  }
  const confidence = status === "insufficient-evidence" ? { level: "insufficient" as const, reason: answer.confidence.reason } : answer.confidence;

  return {
    status,
    directAnswer,
    studentExplanation,
    hormones,
    keyTerms: answer.keyTerms.slice(0, 6),
    confidence,
    mainFindings,
    mixedOrContradictory,
    limitations: answer.limitations,
    uncertainty: answer.uncertainty,
    supportingStudies,
    regions,
    validationNotes: notes,
  };
}
