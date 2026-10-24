import { Link } from "react-router-dom";
import { REGION_BY_ID } from "../../shared/regions";
import { IconSearch } from "../icons";

const KIND_LABEL = { lobe: "Lobe", "cortical-area": "Cortical area", "deep-structure": "Deep structure", hindbrain: "Hindbrain" };

export function RegionPanel({ regionId, onAsk }: { regionId: string | null; onAsk: (q: string) => void }) {
  const region = regionId ? REGION_BY_ID.get(regionId) : undefined;
  if (!region) {
    return (
      <div className="empty">
        <p>Select a region on the brain, or from the list under it, to see an overview.</p>
      </div>
    );
  }
  return (
    <div className="stack fade-in">
      <div>
        <div className="eyebrow">{KIND_LABEL[region.kind]}</div>
        <h2 style={{ fontSize: 22, marginTop: 4 }}>{region.name}</h2>
      </div>
      <section>
        <div className="section-label">General overview</div>
        <p className="dim">{region.overview}</p>
      </section>
      <section>
        <div className="section-label">Commonly studied in relation to</div>
        <div className="row wrap" style={{ gap: 6 }}>
          {region.commonlyStudiedIn.map((t) => (
            <button key={t} className="chip" onClick={() => onAsk(`What evidence connects the ${region.name.toLowerCase()} to ${t}?`)}>{t}</button>
          ))}
        </div>
      </section>
      <div className="notice amber small">
        <span><strong>Interpret with care.</strong> {region.caution}</span>
      </div>
      <div className="row wrap">
        <button className="btn primary" onClick={() => onAsk(`What does research show about the role of the ${region.name.toLowerCase()}?`)}>
          Ask about this region
        </button>
        <Link className="btn" to={`/library?q=${encodeURIComponent(region.searchQuery)}`}>
          <IconSearch size={15} /> Find studies
        </Link>
      </div>
      <p className="xs faint">
        Source: the overview is a general educational summary written for Brain Explorer from standard neuroanatomy, not from a specific study.
        It is shown so you know where to start; use "Ask" or "Find studies" to see published evidence. On the schematic model, region outlines are approximate.
      </p>
    </div>
  );
}
