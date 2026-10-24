// Neuroscience helpers that make retrieval more brain-focused:
//  - translate everyday wording into the terms scientists use in papers
//  - detect when the user is asking about hormones
//  - map a character's age to PubMed's age groups
//  - describe how well each study's population matches the character

import type { AgeGroup, PopulationMatch, ResearchRecord } from "../../shared/types.js";

/** Everyday phrase → scientific search phrase (applied to the search topic only). */
const LAY_TO_SCIENCE: [RegExp, string][] = [
  [/\b((pull(s|ed|ing)?|did|does|do) )?(an )?all[- ]?nighters?\b|\b(no sleep|didn'?t sleep|stay(s|ed)? up all night)\b/gi, "sleep deprivation"],
  [/\b(too little sleep|not enough sleep|short sleep|tired)\b/gi, "sleep restriction"],
  [/\b(scary movies?|horror movies?|scared|frightened|afraid)\b/gi, "fear"],
  [/\b(video ?games?|gaming)\b/gi, "video games"],
  [/\b(phones?|smartphones?|scrolling|social media|screens?)\b/gi, "screen time"],
  [/\b(energy drinks?|coffee)\b/gi, "caffeine"],
  [/\b(running|went for a run|jogging|working out|workout)\b/gi, "aerobic exercise"],
  [/\b(left out|lonely|excluded|rejected by friends)\b/gi, "social exclusion"],
  [/\b(test|exam)s? (stress|anxiety)\b/gi, "academic stress"],
  [/\b(stressed|stressful)\b/gi, "stress"],
  [/\b(head injury|hit (his|her|their) head|concussed)\b/gi, "concussion"],
  [/\b(learning (a |an )?(instrument|guitar|piano))\b/gi, "musical training"],
  [/\b(winning|won (a|the|his) game)\b/gi, "reward"],
  [/\b(hangry|hungry|skipp(ed|ing) breakfast)\b/gi, "breakfast skipping"],
];

export function toScientificTopic(topic: string): string {
  let t = topic;
  for (const [re, sci] of LAY_TO_SCIENCE) t = t.replace(re, sci);
  return t.replace(/\s+/g, " ").trim();
}

export const HORMONE_RE =
  /\b(hormones?|hormonal|cortisol|melatonin|testosterone|estrogen|oestrogen|adrenaline|epinephrine|noradrenaline|oxytocin|insulin|growth hormone|ghrelin|leptin|thyroid|puberty|pubertal|hpa axis|endocrine|glands?)\b/i;

export function asksAboutHormones(question: string): boolean {
  return HORMONE_RE.test(question);
}

export function ageGroupForAge(age: number): AgeGroup {
  if (age <= 12) return "child";
  if (age <= 18) return "adolescent"; // MeSH "Adolescent" = 13–18
  return "young-adult"; // MeSH "Young Adult" = 19–24
}

const AGE_LABEL: Record<AgeGroup, string> = {
  child: "children",
  adolescent: "teenagers",
  "young-adult": "young adults",
  adult: "adults",
  "middle-aged": "middle-aged adults",
  "older-adult": "older adults",
};

/** Close-enough age groups (a 19-year-old is also indexed as "Adult" in PubMed). */
const COMPATIBLE: Record<AgeGroup, AgeGroup[]> = {
  child: ["child"],
  adolescent: ["adolescent"],
  "young-adult": ["young-adult", "adult"],
  adult: ["adult", "young-adult"],
  "middle-aged": ["middle-aged"],
  "older-adult": ["older-adult"],
};

export function populationMatch(r: ResearchRecord, group: AgeGroup, name: string): PopulationMatch {
  const species = r.species.value;
  const human = species.includes("Humans");
  const animal = !human && species.some((s) => s !== "Humans");
  const ages = r.ageGroups.value;
  const age: PopulationMatch["age"] = !ages.length ? "not-indexed" : ages.some((a) => COMPATIBLE[group].includes(a)) ? "same-age-group" : "different-age-group";
  const sexes = r.meshTerms.filter((m) => m === "Male" || m === "Female");
  const includesMales = sexes.length ? sexes.includes("Male") : null;

  let note: string;
  if (animal) note = `Animal study — findings may not apply to ${name}'s brain the same way.`;
  else if (age === "same-age-group") note = `Includes ${AGE_LABEL[group]}, like ${name}.`;
  else if (age === "different-age-group") note = `Studied ${ages.map((a) => AGE_LABEL[a]).join(", ")} — results may differ for ${AGE_LABEL[group]} like ${name}.`;
  else note = "PubMed does not list the participants' age group — check the paper.";
  return { age, species: human ? "human" : animal ? "animal" : "not-indexed", includesMales, note };
}
