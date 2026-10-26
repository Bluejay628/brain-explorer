// App-wide state kept in the browser's localStorage:
//   - saved studies (a full copy, so they open even if the server is offline)
//   - settings
//   - recently explored questions and regions
// Nothing here is sent to any server. Clearing browser data removes it.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ALL_SOURCES, type CharacterProfile, type ResearchRecord, type SourceId } from "../shared/types";
import { clampAge } from "../shared/lifeStage";

export interface Settings {
  theme: "lab" | "contrast";
  includePubMedByDefault: boolean;
  humansOnlyByDefault: boolean;
  autoRotate: boolean;
  /** Which online research databases to search. */
  sources: SourceId[];
  /** Let the AI search trusted websites when studies are thin. */
  webSearch: boolean;
  /** Citation style for "Cite" buttons. */
  citationStyle: "apa" | "mla";
}

export interface CharacterState extends CharacterProfile {
  /** Include hormones in answers (off unless the user asks). */
  includeHormones: boolean;
}

export interface HistoryItem {
  kind: "question" | "region";
  value: string;
  label: string;
  at: string;
}

const DEFAULT_SETTINGS: Settings = { theme: "lab", includePubMedByDefault: true, humansOnlyByDefault: false, autoRotate: true, sources: ALL_SOURCES, webSearch: true, citationStyle: "apa" };
const DEFAULT_CHARACTER: CharacterState = { name: "Leo", age: 16, includeHormones: false };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function readArray<T>(key: string): T[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked (private mode) — the app still works for this visit */
  }
}

interface Store {
  settings: Settings;
  updateSettings: (s: Partial<Settings>) => void;
  saved: ResearchRecord[];
  isSaved: (id: string) => boolean;
  toggleSaved: (r: ResearchRecord) => void;
  removeSaved: (id: string) => void;
  history: HistoryItem[];
  addHistory: (item: Omit<HistoryItem, "at">) => void;
  character: CharacterState;
  updateCharacter: (c: Partial<CharacterState>) => void;
  /** Subdivisions the user has "added" to the brain (highlighted with their functions). */
  pinned: string[];
  togglePinned: (id: string) => void;
  clearPinned: () => void;
  clearAll: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => read("be.settings", DEFAULT_SETTINGS));
  const [saved, setSaved] = useState<ResearchRecord[]>(() => readArray("be.saved"));
  const [history, setHistory] = useState<HistoryItem[]>(() => readArray("be.history"));
  const [character, setCharacter] = useState<CharacterState>(() => read("be.character", DEFAULT_CHARACTER));
  const [pinned, setPinned] = useState<string[]>(() => readArray("be.pinned"));

  useEffect(() => write("be.settings", settings), [settings]);
  useEffect(() => write("be.saved", saved), [saved]);
  useEffect(() => write("be.history", history), [history]);
  useEffect(() => write("be.character", character), [character]);
  useEffect(() => write("be.pinned", pinned), [pinned]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const toggleSaved = useCallback((r: ResearchRecord) => {
    setSaved((cur) => (cur.some((s) => s.id === r.id) ? cur.filter((s) => s.id !== r.id) : [{ ...r }, ...cur]));
  }, []);

  const addHistory = useCallback((item: Omit<HistoryItem, "at">) => {
    setHistory((cur) => [{ ...item, at: new Date().toISOString() }, ...cur.filter((h) => !(h.kind === item.kind && h.value === item.value))].slice(0, 12));
  }, []);

  const value = useMemo<Store>(
    () => ({
      settings,
      updateSettings: (s) => setSettings((cur) => ({ ...cur, ...s })),
      saved,
      isSaved: (id) => saved.some((s) => s.id === id),
      toggleSaved,
      removeSaved: (id) => setSaved((cur) => cur.filter((s) => s.id !== id)),
      history,
      addHistory,
      character,
      updateCharacter: (c) =>
        setCharacter((cur) => {
          const next = { ...cur, ...c };
          next.age = clampAge(next.age);
          next.name = next.name.replace(/[^\p{L}' -]/gu, "").slice(0, 24);
          return next;
        }),
      pinned,
      togglePinned: (id) => setPinned((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-10))),
      clearPinned: () => setPinned([]),
      clearAll: () => {
        setSaved([]);
        setHistory([]);
        setSettings(DEFAULT_SETTINGS);
        setCharacter(DEFAULT_CHARACTER);
        setPinned([]);
      },
    }),
    [settings, saved, history, toggleSaved, addHistory, character, pinned],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}
