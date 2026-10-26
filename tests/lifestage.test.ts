import { describe, expect, it } from "vitest";
import { clampAge, lifeStageForAge, personNoun } from "../shared/lifeStage.js";
import { characterQuestion, dayForAge, scenariosForAge } from "../src/character/scenarios.js";
import { extractIntent } from "../server/ai/intent.js";

describe("Ages 3–90", () => {
  it("clamps ages and names life stages", () => {
    expect([clampAge(1), clampAge(95), clampAge(40.4)]).toEqual([3, 90, 40]);
    expect([5, 15, 40, 80].map(lifeStageForAge)).toEqual(["child", "teen", "adult", "older-adult"]);
    expect([5, 15, 40, 80].map(personNoun)).toEqual(["boy", "teenage boy", "man", "older man"]);
  });

  it("offers situations and a daily schedule that fit each age", () => {
    expect(scenariosForAge(6).map((s) => s.id)).toContain("learn-read");
    expect(scenariosForAge(6).map((s) => s.id)).not.toContain("work-stress");
    expect(scenariosForAge(70).map((s) => s.id)).toContain("daily-walk");
    expect(scenariosForAge(70).map((s) => s.id)).not.toContain("all-nighter");
    expect(dayForAge(8)[0].title).toBe("Wakes up");
    expect(dayForAge(75).some((e) => e.title === "Morning walk")).toBe(true);
  });

  it("never turns the character's description into a hidden age filter", () => {
    for (const age of [5, 16, 40, 70]) {
      const q = characterQuestion("Leo", age, "takes a brisk walk", false);
      const i = extractIntent(q, { character: { name: "Leo", age } });
      expect(i.filters.ageGroups, q).toBeUndefined();
      expect(i.topic).not.toMatch(/\b(boy|man|teenage|older|year)\b/);
    }
  });

  it("still applies an age filter the user typed on purpose", () => {
    const i = extractIntent("How does exercise affect memory in older adults?", { character: { name: "Leo", age: 16 } });
    expect(i.filters.ageGroups).toEqual(["older-adult"]);
  });
});
