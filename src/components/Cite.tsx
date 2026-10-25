import { useState } from "react";
import type { ResearchRecord, WebSource } from "../../shared/types";
import { bibliography, citeStudy, citeWeb, type Citation, type CitationStyle } from "../../shared/citations";
import { useStore } from "../store";
import { IconCheck, IconDoc } from "../icons";

/** Copy rich text (keeps italics in Google Docs / Word) with a plain-text fallback. */
export async function copyCitation(c: Citation): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": new Blob([c.html], { type: "text/html" }), "text/plain": new Blob([c.text], { type: "text/plain" }) }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(c.text);
    return true;
  } catch {
    return false;
  }
}

function StyleSwitch({ style, onChange }: { style: CitationStyle; onChange: (s: CitationStyle) => void }) {
  return (
    <div className="row" role="group" aria-label="Citation style" style={{ gap: 4 }}>
      {(["apa", "mla"] as const).map((s) => (
        <button key={s} className="btn sm ghost" aria-pressed={style === s} onClick={() => onChange(s)}>
          {s.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function CopyButton({ citation, label = "Copy" }: { citation: Citation; label?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      className="btn sm"
      onClick={async () => {
        setState((await copyCitation(citation)) ? "ok" : "fail");
        setTimeout(() => setState("idle"), 2000);
      }}
    >
      {state === "ok" ? <><IconCheck size={14} /> Copied</> : state === "fail" ? "Select & copy manually" : label}
    </button>
  );
}

/** Small "Cite" button that opens the formatted citation for one study or web page. */
export function CiteButton({ record, web, small = true }: { record?: ResearchRecord; web?: WebSource; small?: boolean }) {
  const { settings, updateSettings } = useStore();
  const [open, setOpen] = useState(false);
  const style = settings.citationStyle;
  const c = record ? citeStudy(record, style) : web ? citeWeb(web, style) : null;
  if (!c) return null;
  return (
    <span className="cite-wrap">
      <button className={`btn ${small ? "sm" : ""} ghost`} aria-expanded={open} onClick={() => setOpen((v) => !v)} title="Get a formatted citation">
        <IconDoc size={14} /> Cite
      </button>
      {open && (
        <div className="cite-pop panel" role="dialog" aria-label="Citation">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <StyleSwitch style={style} onChange={(s) => updateSettings({ citationStyle: s })} />
            <CopyButton citation={c} />
          </div>
          <p className="cite-text" dangerouslySetInnerHTML={{ __html: c.html }} />
          <p className="xs faint">Check against your teacher's style guide. Volume, issue and page numbers aren't included; the link lets readers find the full reference.</p>
        </div>
      )}
    </span>
  );
}

/** A full bibliography for a set of sources, with a style switch and "Copy all". */
export function Bibliography({ records, webSources = [], title = "Cite these sources" }: { records: ResearchRecord[]; webSources?: WebSource[]; title?: string }) {
  const { settings, updateSettings } = useStore();
  const style = settings.citationStyle;
  if (!records.length && !webSources.length) return null;
  const bib = bibliography([...records.map((r) => citeStudy(r, style)), ...webSources.map((w) => citeWeb(w, style))]);
  return (
    <section className="panel panel-pad">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="section-label" style={{ margin: 0 }}>{title} ({style.toUpperCase()})</div>
        <div className="row" style={{ gap: 6 }}>
          <StyleSwitch style={style} onChange={(s) => updateSettings({ citationStyle: s })} />
          <CopyButton citation={bib} label="Copy all" />
        </div>
      </div>
      <div className="bibliography" dangerouslySetInnerHTML={{ __html: bib.html }} />
    </section>
  );
}
