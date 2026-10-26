// Ages and life stages for the character (3–90 years).
// Age groups follow PubMed's MeSH definitions so the app can prefer studies of
// people the character's age.

import type { AgeGroup } from "./types.js";

export const AGE_MIN = 3;
export const AGE_MAX = 90;

export type LifeStage = "child" | "teen" | "adult" | "older-adult";

export function clampAge(age: number): number {
  return Math.min(AGE_MAX, Math.max(AGE_MIN, Math.round(age)));
}

/** MeSH: Child 2–12 (incl. preschool), Adolescent 13–18, Young Adult 19–24, Adult 19–44, Middle Aged 45–64, Aged 65+. */
export function ageGroupForAge(age: number): AgeGroup {
  if (age <= 12) return "child";
  if (age <= 18) return "adolescent";
  if (age <= 24) return "young-adult";
  if (age <= 44) return "adult";
  if (age <= 64) return "middle-aged";
  return "older-adult";
}

export function lifeStageForAge(age: number): LifeStage {
  if (age <= 12) return "child";
  if (age <= 18) return "teen";
  if (age <= 64) return "adult";
  return "older-adult";
}

/** "boy", "teenage boy", "man", "older man" — used in questions about the character. */
export function personNoun(age: number): string {
  if (age <= 12) return "boy";
  if (age <= 17) return "teenage boy";
  if (age <= 64) return "man";
  return "older man";
}

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  child: "Child (PubMed: 2–12)",
  adolescent: "Teen (PubMed: 13–18)",
  "young-adult": "Young adult (PubMed: 19–24)",
  adult: "Adult (PubMed: 19–44)",
  "middle-aged": "Middle-aged (PubMed: 45–64)",
  "older-adult": "Older adult (PubMed: 65+)",
};
