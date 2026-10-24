import { useState } from "react";
import { REGION_BY_ID, TOP_LEVEL, childrenOf, descendantsOf } from "../../shared/regions";
import { useStore } from "../store";
import { PIN_COLORS } from "../brain/scene";
import { IconX } from "../icons";

/** Add or remove atlas subdivisions; added ones are colored on the brain and listed with their functions. */
export function SubdivisionPanel({ onSelect, onAsk }: { onSelect: (id: string) => void; onAsk: (q: string) => void }) {
  const { pinned, togglePinned, clearPinned } = useStore();
  const [open, setOpen] = useState<string | null>("prefrontal-cortex");
  const groups = TOP_LEVEL.filter((r) => descendantsOf(r.id).some((d) => d.meshKeys?.length || d.marker));

  return (
    <div className="stack">
      {pinned.length > 0 && (
        <section>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="section-label" style={{ margin: 0 }}>Added to the brain ({pinned.length}/10)</div>
            <button className="btn sm ghost" onClick={clearPinned}>Remove all</button>
          </div>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            {pinned.map((id, i) => {
              const r = REGION_BY_ID.get(id);
              if (!r) return null;
              return (
                <div key={id} className="pinned-item">
                  <span className="swatch" style={{ background: PIN_COLORS[i % PIN_COLORS.length] }} aria-hidden="true" />
                  <div className="grow">
                    <button className="link-btn" onClick={() => onSelect(id)}>{r.name}</button>
                    <p className="xs dim">{r.overview}</p>
                    <p className="xs faint">Commonly studied in: {r.commonlyStudiedIn.join(", ")}</p>
                  </div>
                  <button className="btn sm icon ghost" onClick={() => togglePinned(id)} aria-label={`Remove ${r.name}`}><IconX size={14} /></button>
                </div>
              );
            })}
          </div>
          {pinned.length >= 2 && (
            <button
              className="btn sm"
              style={{ marginTop: 10 }}
              onClick={() => onAsk(`What does research show about how the ${pinned.map((id) => REGION_BY_ID.get(id)?.name.replace(/ \(.*\)/, "").toLowerCase()).join(" and the ")} work together?`)}
            >
              Ask how these work together
            </button>
          )}
        </section>
      )}

      <section>
        <div className="section-label">Subdivisions (Desikan-Killiany atlas + subcortical structures)</div>
        <p className="xs faint" style={{ marginBottom: 8 }}>Add a subdivision to color it on the brain and keep its function in view. Overviews are general textbook summaries, not study findings.</p>
        <div className="stack-sm">
          {groups.map((g) => {
            const subs = descendantsOf(g.id).filter((d) => d.meshKeys?.length || d.marker);
            const expanded = open === g.id;
            return (
              <div key={g.id} className="sub-group">
                <button className="sub-group-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : g.id)}>
                  <span>{g.name}</span>
                  <span className="xs faint">{subs.length} {expanded ? "▴" : "▾"}</span>
                </button>
                {expanded && (
                  <ul className="sub-list">
                    {subs.map((sub) => {
                      const added = pinned.includes(sub.id);
                      return (
                        <li key={sub.id}>
                          <div className="grow">
                            <button className="link-btn" onClick={() => onSelect(sub.id)}>
                              {childrenOf(g.id).includes(sub) ? "" : "↳ "}{sub.name}
                            </button>
                            <span className="xs faint" style={{ display: "block" }}>{sub.commonlyStudiedIn.slice(0, 3).join(" · ")}</span>
                          </div>
                          <button className={`btn sm ${added ? "" : "ghost"}`} aria-pressed={added} onClick={() => togglePinned(sub.id)}>
                            {added ? "Added" : "+ Add"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
