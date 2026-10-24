// Situations and a "day in the life" for the character.
//
// These contain NO scientific claims — only questions. Every answer comes from
// the research engine, built from retrieved studies with checked citations.

export interface Scenario {
  id: string;
  title: string;
  /** Completes the sentence "What happens in the brain of a 16-year-old boy who …" */
  situation: string;
  /** Research focus in scientific terms — used as the search topic. */
  focus: string;
  /** Optional safety note shown with the scenario. */
  note?: string;
}

export const SCENARIOS: Scenario[] = [
  { id: "all-nighter", title: "Pulled an all-nighter", situation: "pulls an all-nighter before school", focus: "sleep deprivation" },
  { id: "exam-stress", title: "Big exam stress", situation: "is stressed about a big exam", focus: "academic stress" },
  { id: "run", title: "Went for a run", situation: "went for a 30-minute run (aerobic exercise)", focus: "acute aerobic exercise cognition" },
  { id: "gaming", title: "Gaming for hours", situation: "plays video games for several hours", focus: "video games" },
  { id: "phone-in-bed", title: "Phone in bed", situation: "uses his phone in bed late at night", focus: "bedtime screen use sleep" },
  { id: "music", title: "Learning guitar", situation: "is learning to play guitar (musical training)", focus: "musical training" },
  { id: "scary-movie", title: "Scary movie", situation: "is scared while watching a horror movie (fear)", focus: "fear" },
  { id: "caffeine", title: "Energy drink", situation: "drinks an energy drink with caffeine", focus: "caffeine" },
  { id: "left-out", title: "Left out by friends", situation: "feels left out by his friends (social exclusion)", focus: "social exclusion" },
  { id: "won-game", title: "Won the game", situation: "wins an important game (reward)", focus: "reward processing" },
  {
    id: "concussion",
    title: "Hit his head in soccer",
    situation: "gets a sports concussion in soccer", focus: "sports concussion",
    note: "Educational only. Anyone with a head injury should be checked by a doctor.",
  },
  { id: "meditation", title: "Tries meditation", situation: "practices mindfulness meditation", focus: "mindfulness meditation" },
];

export interface TimelineEvent {
  time: string;
  title: string;
  situation: string;
  focus: string;
}

export const DAY: TimelineEvent[] = [
  { time: "6:45", title: "Wakes up for school", situation: "wakes up early for school after too little sleep", focus: "school start time sleep" },
  { time: "8:15", title: "First class", situation: "has to pay attention in a morning class", focus: "sustained attention" },
  { time: "10:30", title: "Math test", situation: "takes a stressful math test", focus: "math anxiety" },
  { time: "12:30", title: "Lunch with friends", situation: "spends time laughing with friends (social connection)", focus: "peer social interaction" },
  { time: "15:30", title: "Soccer practice", situation: "plays soccer (aerobic exercise)", focus: "physical activity cognition" },
  { time: "17:30", title: "Homework", situation: "studies and memorizes for homework (learning and memory)", focus: "memory encoding learning" },
  { time: "20:00", title: "Video games", situation: "plays video games", focus: "video games" },
  { time: "22:30", title: "Phone in bed", situation: "scrolls social media in bed late at night", focus: "social media use sleep" },
  { time: "23:30", title: "Sleep", situation: "is asleep (what happens during sleep, like memory consolidation)", focus: "sleep memory consolidation" },
];

export function characterQuestion(name: string, age: number, situation: string, hormones: boolean): string {
  return `What happens in ${name}'s brain (a ${age}-year-old boy) when he ${situation}?${hormones ? " Include how hormones are involved." : ""}`;
}
