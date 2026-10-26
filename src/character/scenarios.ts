// Situations and a "day in the life" for the character, for every life stage.
//
// These contain NO scientific claims — only questions. Every answer comes from
// the research engine, built from retrieved studies with checked citations.

import { lifeStageForAge, personNoun, type LifeStage } from "../../shared/lifeStage";

export interface Scenario {
  id: string;
  title: string;
  /** Completes the sentence "What happens in his brain when he …" */
  situation: string;
  /** Research focus in scientific terms — used as the search topic. */
  focus: string;
  /** Life stages this situation fits (default: all). */
  stages?: LifeStage[];
  /** Optional safety note shown with the scenario. */
  note?: string;
}

const YOUNG: LifeStage[] = ["child", "teen"];
const GROWN: LifeStage[] = ["adult", "older-adult"];

export const SCENARIOS: Scenario[] = [
  { id: "all-nighter", title: "Pulled an all-nighter", situation: "pulls an all-nighter", focus: "sleep deprivation", stages: ["teen", "adult"] },
  { id: "exam-stress", title: "Big exam stress", situation: "is stressed about a big exam", focus: "academic stress", stages: ["child", "teen", "adult"] },
  { id: "run", title: "Went for a run", situation: "goes for a 30-minute run (aerobic exercise)", focus: "acute aerobic exercise cognition" },
  { id: "gaming", title: "Gaming for hours", situation: "plays video games for several hours", focus: "video games" },
  { id: "phone-in-bed", title: "Phone in bed", situation: "uses his phone in bed late at night", focus: "bedtime screen use sleep", stages: ["child", "teen", "adult"] },
  { id: "music", title: "Learning an instrument", situation: "is learning to play guitar (musical training)", focus: "musical training" },
  { id: "scary-movie", title: "Scary movie", situation: "is scared while watching a horror movie (fear)", focus: "fear" },
  { id: "caffeine", title: "Energy drink / coffee", situation: "drinks coffee or an energy drink (caffeine)", focus: "caffeine", stages: ["teen", "adult", "older-adult"] },
  { id: "left-out", title: "Left out / lonely", situation: "feels left out or lonely (social exclusion)", focus: "social exclusion" },
  { id: "won-game", title: "Won the game", situation: "wins an important game (reward)", focus: "reward processing" },
  {
    id: "concussion",
    title: "Hit his head playing sports",
    situation: "gets a sports concussion",
    focus: "sports concussion",
    stages: ["child", "teen", "adult"],
    note: "Educational only. Anyone with a head injury should be checked by a doctor.",
  },
  { id: "meditation", title: "Tries meditation", situation: "practices mindfulness meditation", focus: "mindfulness meditation", stages: ["teen", "adult", "older-adult"] },
  { id: "learn-read", title: "Learning to read", situation: "is learning to read", focus: "reading acquisition children", stages: ["child"] },
  { id: "recess", title: "Plays at recess", situation: "runs around playing at recess (physical activity)", focus: "physical activity children cognition", stages: YOUNG },
  { id: "work-stress", title: "Stressful job", situation: "has months of stress at work (chronic stress)", focus: "chronic stress", stages: GROWN },
  { id: "new-language", title: "Learns a new language", situation: "learns a second language as an adult", focus: "second language learning", stages: GROWN },
  { id: "daily-walk", title: "Daily walks", situation: "walks briskly every day (physical activity)", focus: "walking exercise cognition aging", stages: GROWN },
  { id: "puzzles", title: "Brain games & puzzles", situation: "does puzzles and brain-training games", focus: "cognitive training", stages: GROWN },
  { id: "poor-sleep", title: "Years of poor sleep", situation: "sleeps badly for years (chronic sleep loss)", focus: "chronic sleep loss", stages: GROWN },
];

export function scenariosForAge(age: number): Scenario[] {
  const stage = lifeStageForAge(age);
  // Situations made for this life stage come first, then ones that fit everyone.
  const fits = SCENARIOS.filter((s) => !s.stages || s.stages.includes(stage));
  return [...fits].sort((a, b) => (a.stages?.length ?? 9) - (b.stages?.length ?? 9));
}

export interface TimelineEvent {
  time: string;
  title: string;
  situation: string;
  focus: string;
}

export const DAYS: Record<LifeStage, TimelineEvent[]> = {
  child: [
    { time: "7:00", title: "Wakes up", situation: "wakes up for school", focus: "sleep children" },
    { time: "8:30", title: "Reading lesson", situation: "practices reading in class", focus: "reading acquisition children" },
    { time: "10:30", title: "Recess", situation: "runs around at recess (physical activity)", focus: "physical activity children cognition" },
    { time: "12:00", title: "Lunch", situation: "eats lunch with friends (social connection)", focus: "peer social interaction children" },
    { time: "13:30", title: "Math class", situation: "learns new math facts", focus: "arithmetic learning children" },
    { time: "16:00", title: "Screen time", situation: "watches videos on a tablet", focus: "screen time children" },
    { time: "19:30", title: "Bedtime story", situation: "listens to a bedtime story (shared reading)", focus: "shared book reading language" },
    { time: "20:30", title: "Sleep", situation: "is asleep (what happens during sleep, like memory consolidation)", focus: "sleep memory consolidation children" },
  ],
  teen: [
    { time: "6:45", title: "Wakes up for school", situation: "wakes up early for school after too little sleep", focus: "school start time sleep" },
    { time: "8:15", title: "First class", situation: "has to pay attention in a morning class", focus: "sustained attention" },
    { time: "10:30", title: "Math test", situation: "takes a stressful math test", focus: "math anxiety" },
    { time: "12:30", title: "Lunch with friends", situation: "spends time laughing with friends (social connection)", focus: "peer social interaction" },
    { time: "15:30", title: "Soccer practice", situation: "plays soccer (aerobic exercise)", focus: "physical activity cognition" },
    { time: "17:30", title: "Homework", situation: "studies and memorizes for homework (learning and memory)", focus: "memory encoding learning" },
    { time: "20:00", title: "Video games", situation: "plays video games", focus: "video games" },
    { time: "22:30", title: "Phone in bed", situation: "scrolls social media in bed late at night", focus: "social media use sleep" },
    { time: "23:30", title: "Sleep", situation: "is asleep (what happens during sleep, like memory consolidation)", focus: "sleep memory consolidation" },
  ],
  adult: [
    { time: "6:30", title: "Alarm & coffee", situation: "wakes up and drinks coffee (caffeine)", focus: "caffeine" },
    { time: "8:00", title: "Commute", situation: "drives to work in heavy traffic (stress)", focus: "commuting stress" },
    { time: "10:00", title: "Focused work", situation: "concentrates on a hard task at work", focus: "sustained attention" },
    { time: "13:00", title: "Big meeting", situation: "gives a presentation (public speaking stress)", focus: "public speaking anxiety" },
    { time: "17:30", title: "Gym", situation: "works out at the gym (aerobic exercise)", focus: "aerobic exercise cognition" },
    { time: "19:30", title: "Dinner with family", situation: "has dinner with family (social connection)", focus: "social support" },
    { time: "22:00", title: "Late-night phone", situation: "scrolls his phone in bed", focus: "bedtime screen use sleep" },
    { time: "23:00", title: "Sleep", situation: "is asleep (what happens during sleep)", focus: "sleep memory consolidation" },
  ],
  "older-adult": [
    { time: "7:00", title: "Morning walk", situation: "takes a brisk morning walk (physical activity)", focus: "walking exercise cognition aging" },
    { time: "9:00", title: "Crossword", situation: "does a crossword puzzle", focus: "cognitive activity aging" },
    { time: "11:00", title: "Learning something new", situation: "learns a new skill, like a language or instrument", focus: "learning aging" },
    { time: "13:00", title: "Lunch with friends", situation: "has lunch with friends (social connection)", focus: "social engagement aging" },
    { time: "15:00", title: "Forgets a name", situation: "briefly can't remember someone's name (normal memory changes)", focus: "memory aging" },
    { time: "17:00", title: "Gardening", situation: "gardens outdoors (light activity)", focus: "physical activity older adults" },
    { time: "21:30", title: "Sleep", situation: "is asleep (sleep changes with age)", focus: "sleep aging" },
  ],
};

/** Teen day kept as DAY for older code (e.g. the seed script). */
export const DAY = DAYS.teen;

export function dayForAge(age: number): TimelineEvent[] {
  return DAYS[lifeStageForAge(age)];
}

export function characterQuestion(name: string, age: number, situation: string, hormones: boolean): string {
  return `What happens in ${name}'s brain (a ${age}-year-old ${personNoun(age)}) when he ${situation}?${hormones ? " Include how hormones are involved." : ""}`;
}
