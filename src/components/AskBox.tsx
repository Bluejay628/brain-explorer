import { useEffect, useState, type FormEvent } from "react";
import { IconArrowRight, IconSpark } from "../icons";

export const SUGGESTED_QUESTIONS = [
  "How does sleep restriction affect working memory?",
  "Find recent studies on stress and memory.",
  "Compare adolescent and adult findings on working memory.",
  "What evidence connects the hippocampus to memory consolidation?",
  "Show me functional MRI studies about attention.",
  "What are the limitations of the evidence on exercise and the hippocampus?",
];

interface Props {
  onAsk: (q: string) => void;
  initial?: string;
  busy?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

export function AskBox({ onAsk, initial = "", busy = false, autoFocus = false, placeholder = "Ask a question about the brain" }: Props) {
  const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    if (t.length >= 3 && !busy) onAsk(t);
  };
  return (
    <form className="ask" onSubmit={submit} role="search">
      <IconSpark className="lead" size={18} />
      <label htmlFor="ask-input" className="sr-only">{placeholder}</label>
      <input
        id="ask-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        maxLength={500}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      <button className="btn primary" type="submit" disabled={busy || q.trim().length < 3}>
        {busy ? <span className="spinner" /> : <IconArrowRight size={16} />}
        <span>{busy ? "Researching" : "Ask"}</span>
      </button>
    </form>
  );
}
