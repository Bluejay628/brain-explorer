// Rule-based intent extraction.
//
// Why rules instead of AI? They are free, instant, predictable, and testable —
// and they only ever apply filters the user actually stated. Every filter that
// gets applied is explained in `interpretationNotes` so users can see it.

import type { AgeGroup, EvidenceMethod, ExtractedIntent, PublicationCategory, SearchFilters } from "../../shared/types.js";
import { findRegionMentions, REGION_BY_ID } from "../../shared/regions.js";

interface IntentContext {
  selectedRegionId?: string;
  now?: Date;
}

const AGE_RULES: [AgeGroup, RegExp, string][] = [
  ["child", /\b(child|children|childhood|kids?|pediatric|paediatric)\b/i, "children"],
  ["adolescent", /\b(adolescen\w*|teen\w*|youth|puberty)\b/i, "adolescents"],
  ["young-adult", /\byoung adults?\b/i, "young adults"],
  ["older-adult", /\b(older adults?|elderly|aging|ageing|seniors?|late life)\b/i, "older adults"],
  ["adult", /\badults?\b/i, "adults"],
];

const CATEGORY_RULES: [PublicationCategory, RegExp][] = [
  ["meta-analysis", /\bmeta[- ]?analy\w*/i],
  ["systematic-review", /\bsystematic reviews?\b/i],
  ["randomized-controlled-trial", /\b(randomi[sz]ed controlled trials?|rcts?)\b/i],
];

const METHOD_RULES: [EvidenceMethod, RegExp][] = [
  ["functional-mri", /\b(fmri|functional mri|functional magnetic resonance|brain activation|activation studies)\b/i],
  ["structural-mri", /\b(structural mri|gr[ae]y matter|cortical thickness|brain volume|morphometry)\b/i],
  ["diffusion-connectivity", /\b(dti|diffusion tensor|white matter|tractography)\b/i],
  ["functional-connectivity", /\b(functional connectivity|resting[- ]state)\b/i],
  ["eeg-meg", /\b(eeg|meg|electroencephalograph\w*|erps?)\b/i],
  ["pet", /\bpet (scan|imaging|studies)\b/i],
  ["animal-model", /\b(animal (models?|studies)|in mice|in rats|rodent\w*)\b/i],
];

// Words that describe the *request* rather than the scientific topic.
const REQUEST_WORDS =
  /\b(find|show|list|give|search|recent|latest|new|newer|studies|study|papers?|articles?|research|evidence|publications?|compare|comparing|comparison|versus|vs|what|which|how|does|do|is|are|can|tell|me|about|the|a|an|of|on|in|for|and|or|to|with|from|between|connects?|connecting|link|links|linked|limitations?|strength|quality|this|that|affects?|effects?|impacts?|influences?|change|changes|region|area|structure|brain region|explain|role|since|after|before|during|last|past|years?|published|findings|show me|functional mri|fmri|meta[- ]?analy\w*|systematic reviews?|reviews?|rcts?|randomi[sz]ed controlled trials?|humans?|people|adults?|adolescen\w*|teen\w*|children|child|kids?|older|young|elderly|\d{4})\b/gi;

export function extractIntent(question: string, ctx: IntentContext = {}): ExtractedIntent {
  const q = question.trim();
  const now = ctx.now ?? new Date();
  const year = now.getFullYear();
  const notes: string[] = [];
  const filters: SearchFilters = {};

  // ── Task ──
  let task: ExtractedIntent["task"] = "explain";
  if (/\b(limitations?|weakness\w*|how (strong|reliable|good)|quality of (the )?evidence)\b/i.test(q)) task = "limitations";
  else if (/\b(compar\w*|versus|vs\.?|differ\w*)\b/i.test(q)) task = "compare";
  else if (/^\s*(find|show|list|search|give me|get)\b/i.test(q) || /\b(studies|papers|articles) (on|about)\b/i.test(q)) task = "find-studies";

  // ── Age groups (only if stated) ──
  const ages: AgeGroup[] = [];
  const stripped = q.replace(/\b(older|young) adults?\b/gi, (m) => m.replace(/adults?/i, "_")); // so "older adults" ≠ "adults"
  for (const [group, re, label] of AGE_RULES) {
    const target = group === "adult" ? stripped : q;
    if (re.test(target)) {
      ages.push(group);
      notes.push(`You mentioned ${label}, so results are limited to studies PubMed indexes with that age group.`);
    }
  }
  if (ages.length) filters.ageGroups = ages;
  if (task === "compare" && ages.length >= 2) {
    notes.push("Comparison request: studies of either age group are included; few studies directly compare groups.");
  }

  // ── Dates (publication date — not when data were collected) ──
  const between = q.match(/\bbetween (\d{4}) and (\d{4})\b/i);
  const since = q.match(/\b(?:since|after|from) (\d{4})\b/i);
  const before = q.match(/\bbefore (\d{4})\b/i);
  const inYear = q.match(/\b(?:in|published in) (\d{4})\b/i);
  const lastN = q.match(/\b(?:last|past) (\d{1,2}) years?\b/i);
  if (between) {
    filters.yearFrom = Number(between[1]);
    filters.yearTo = Number(between[2]);
  } else {
    if (since) filters.yearFrom = Number(since[1]) + (/after/i.test(since[0]) ? 1 : 0);
    if (before) filters.yearTo = Number(before[1]) - 1;
    if (inYear && !since && !before) filters.yearFrom = filters.yearTo = Number(inYear[1]);
    if (lastN) filters.yearFrom = year - Number(lastN[1]);
  }
  if (!filters.yearFrom && !filters.yearTo && /\b(recent|latest|newest|new)\b/i.test(q)) {
    filters.yearFrom = year - 5;
    notes.push(`You asked for recent studies; this is interpreted as published ${year - 5} or later. Change it in the search filters if you meant something else.`);
  }
  if (filters.yearFrom || filters.yearTo) {
    notes.push("Date filters use the publication date, which is usually later than when the data were collected.");
  }

  // ── Evidence type ──
  const categories = CATEGORY_RULES.filter(([, re]) => re.test(q)).map(([c]) => c);
  if (categories.length) {
    filters.categories = categories;
    notes.push(`Limited to publication type: ${categories.join(", ")}.`);
  }
  const methods = METHOD_RULES.filter(([, re]) => re.test(q)).map(([m]) => m);
  if (methods.length) {
    filters.methods = methods;
    notes.push(`Limited to studies using: ${methods.join(", ")} (detected from abstracts — may miss some studies).`);
  }
  if (/\b(in humans|human studies|human participants|people)\b/i.test(q)) filters.humansOnly = true;

  // ── Regions ──
  const regions = findRegionMentions(q);
  if (ctx.selectedRegionId && REGION_BY_ID.has(ctx.selectedRegionId) && /\bthis (brain )?(region|area|structure|part)\b/i.test(q)) {
    if (!regions.includes(ctx.selectedRegionId)) regions.push(ctx.selectedRegionId);
    notes.push(`"This region" was interpreted as the region selected on the brain: ${REGION_BY_ID.get(ctx.selectedRegionId)!.name}.`);
  }
  if (regions.length && task === "explain" && /\b(role|function|involved|connect\w*|link\w*|do(es)?)\b/i.test(q)) task = "region-function";

  // ── Topic (search terms) ──
  const regionTerms = regions
    .filter((id) => !findRegionMentions(q).includes(id)) // add names only for regions implied by selection
    .map((id) => REGION_BY_ID.get(id)!.searchQuery);
  const topic = [q.replace(/[?.!,;:"()]/g, " ").replace(REQUEST_WORDS, " "), ...regionTerms]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!notes.length) notes.push("No age group, date range or study type was specified, so none was applied.");
  return { topic: topic || q, task, filters, regions, interpretationNotes: notes };
}
