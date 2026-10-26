// Protects the Claude API key on a public website:
//  - a daily cap on paid AI calls (MAX_AI_CALLS_PER_DAY, default 300)
//  - a small in-memory cache so repeated identical questions are free and instant

import { config } from "../config.js";

let day = "";
let used = 0;

function today(): string {
  return new Date().toISOString().slice(0, 10); // resets at midnight UTC
}

/** Reserve one paid AI call. Returns false when today's cap is reached. */
export function takeAiCall(): boolean {
  const d = today();
  if (d !== day) {
    day = d;
    used = 0;
  }
  if (used >= config.maxAiCallsPerDay) return false;
  used++;
  return true;
}

export function aiCallsUsedToday(): number {
  return today() === day ? used : 0;
}

/** Small time-limited cache (least-recently-used eviction). */
export class TtlCache<V> {
  private map = new Map<string, { at: number; value: V }>();
  constructor(private readonly max = 200, private readonly ttlMs = 6 * 60 * 60 * 1000) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit); // mark as recently used
    return hit.value;
  }

  set(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, { at: Date.now(), value });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
}
