// Citation validator — the last line of defence before an AI answer is shown.
//
// Every citation must point to a record that was actually retrieved for this
// question. Claims without valid support are removed (and the removal is
// reported to the user). Brain regions must be real dictionary entries AND be
// mentioned in the studies cited for them.

import type { CitedClaim, ResearchRecord, StudyAssessment } from "../../shared/types.js";
import { REGION_BY_ID } from "../../shared/regions.js";
import type { ModelAnswer } from "./schema.js";

export interface ValidatedAnswer {
  status: "answered" | "insufficient-evidence";
  directAnswer: string;
  mainFindings: CitedClaim[];
  mixedOrContradictory: CitedClaim[];
  limitations: string[];
  uncertainty: string;
  supportingStudies: StudyAssessment[];
  regions: { name: string; citations: string[] }[];
  validationNotes: string[];
}

/** Normalize the citation formats a model might plausibly produce. */
export function normalizeCitation(c: string): string {
  const m = c.trim().match(/^(?:pmid[:\s]*)?(\d{5,9})$/i);
  return m ? `pmid:${m[1]}` : c.trim().toLowerCase();
}

export function validateAnswer(answer: ModelAnswer, evidence: ResearchRecord[]): ValidatedAnswer {
  const allowed = new Map(evidence.map((r) => [r.id, r]));
  const notes: string[] = [];
  const invalidSeen = new Set<string>();

  const checkClaims = (claims: ModelAnswer["mainFindings"], section: string): CitedClaim[] =>
    claims.flatMap((claim) => {
      const normalized = [...new Set(claim.citations.map(normalizeCitation))];
      const valid = normalized.filter((c) => allowed.has(c));
      normalized.filter((c) => !allowed.has(c)).forEach((c) => invalidSeen.add(c));
      // Open questions may legitimately have no citation; everything else needs one.
      if (!valid.length && claim.claimType !== "open-question") {
        notes.push(`Removed an unsupported statement from "${section}" because it had no valid citation.`);
        return [];
      }
      return [{ text: claim.text, citations: valid, claimType: claim.claimType }];
    });

  const mainFindings = checkClaims(answer.mainFindings, "Main findings");
  const mixedOrContradictory = checkClaims(answer.mixedOrContradictory, "Mixed findings");

  const supportingStudies = answer.supportingStudies
    .map((s) => ({ ...s, recordId: normalizeCitation(s.recordId) }))
    .filter((s) => {
      if (allowed.has(s.recordId)) return true;
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
    const citations = r.citations
      .map(normalizeCitation)
      .filter((c) => allowed.get(c)?.regionsMentioned.value.includes(id));
    if (!citations.length) {
      notes.push(`Removed region "${region.name}" because none of its cited studies mention it in their abstract.`);
      return [];
    }
    return [{ name: id, citations }];
  });

  // Free-text fields could still mention a PMID that wasn't retrieved — flag it.
  const freeText = [answer.directAnswer, answer.uncertainty, ...answer.limitations].join(" ");
  for (const m of freeText.matchAll(/\bPMID[:\s]*(\d{5,9})\b/gi)) {
    if (!allowed.has(`pmid:${m[1]}`)) invalidSeen.add(`pmid:${m[1]}`);
  }

  if (invalidSeen.size) {
    notes.push(`The AI referenced ${invalidSeen.size} source(s) that were not in the retrieved evidence; those references were removed.`);
  }

  let status = answer.status;
  let directAnswer = answer.directAnswer;
  for (const bad of invalidSeen) {
    const pmid = bad.replace(/^pmid:/, "");
    directAnswer = directAnswer.replace(new RegExp(`\\(?PMID[:\\s]*${pmid}\\)?`, "gi"), "[unverified reference removed]");
  }
  const hasSupportedFinding = mainFindings.some((c) => c.citations.length > 0);
  if (status === "answered" && !hasSupportedFinding) {
    status = "insufficient-evidence";
    notes.push("No finding in the AI answer was supported by a retrieved study, so it is shown as insufficient evidence.");
  }

  return {
    status,
    directAnswer,
    mainFindings,
    mixedOrContradictory,
    limitations: answer.limitations,
    uncertainty: answer.uncertainty,
    supportingStudies,
    regions,
    validationNotes: notes,
  };
}
