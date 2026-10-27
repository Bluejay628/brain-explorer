import { useNav } from "../nav";
import { REGION_BY_ID, childrenOf, type RegionKind } from "../../shared/regions";
import { useStore } from "../store";
import { personNoun } from "../../shared/lifeStage";
import { IconSearch } from "../icons";

const KIND_LABEL: Record<RegionKind, string> = {
  lobe: "Lobe",
  "cortical-area": "Cortical area",
  subdivision: "Atlas subdivision",
  "deep-structure": "Deep structure",
  hindbrain: "Hindbrain",
  marker: "Gland · approximate marker",
};

interface Props {
  regionId: string | null;
  onAsk: (q: string) => void;
  onSelect: (id: string) => void;
}

export function RegionPanel({ regionId, onAsk, onSelect }: Props) {
  const { pinned, togglePinned, character } = useStore();
  const { searchStudies } = useNav();
  const region = regionId ? REGION_BY_ID.get(regionId) : undefined;
  if (!region) {
    return (
      <div className="empty">
        <p>Click a part of the brain, or pick one from the list at the top of the brain, to see what it does.</p>
      </div>
    );
  }
  const parents: string[] = [];
  for (let p = region.parent; p; p = REGION_BY_ID.get(p)?.parent) parents.unshift(p);
  const subs = childrenOf(region.id);
  const shortName = region.name.replace(/ \(.*\)/, "").toLowerCase();
  const canPin = Boolean(region.meshKeys?.length || region.marker);

  return (
    <div className="stack fade-in">
      <div>
        {parents.length > 0 && (
          <div className="breadcrumb">
            {parents.map((p) => (
              <span key={p}>
                <button className="link-btn xs" style={{ color: "var(--cyan)", fontSize: 12 }} onClick={() => onSelect(p)}>{REGION_BY_ID.get(p)?.name}</button> ›{" "}
              </span>
            ))}
          </div>
        )}
        <div className="eyebrow" style={{ marginTop: 6 }}>{KIND_LABEL[region.kind]}</div>
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
            <button key={t} className="chip" onClick={() => onAsk(`What evidence connects the ${shortName} to ${t} in ${character.name}'s brain (a ${character.age}-year-old ${personNoun(character.age)})?`)}>{t}</button>
          ))}
        </div>
      </section>
      {subs.length > 0 && (
        <section>
          <div className="section-label">Subdivisions</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {subs.map((s) => (
              <button key={s.id} className="chip cyan" onClick={() => onSelect(s.id)}>{s.name}</button>
            ))}
          </div>
        </section>
      )}
      <div className="notice amber small">
        <span><strong>Interpret with care.</strong> {region.caution}</span>
      </div>
      <div className="row wrap">
        <button className="btn primary" onClick={() => onAsk(`What does research show about the ${shortName} in ${character.name}'s brain (a ${character.age}-year-old ${personNoun(character.age)})?`)}>
          Ask about this region
        </button>
        {canPin && (
          <button className="btn" aria-pressed={pinned.includes(region.id)} onClick={() => togglePinned(region.id)}>
            {pinned.includes(region.id) ? "Remove from brain" : "+ Add to brain"}
          </button>
        )}
        <button className="btn ghost" onClick={() => searchStudies(region.searchQuery)}>
          <IconSearch size={15} /> Find studies
        </button>
      </div>
      <p className="xs faint">
        The overview is a general educational summary written for Brain Explorer from standard neuroanatomy, not from a specific study.
        Region outlines come from the Desikan-Killiany atlas on an average brain (FreeSurfer fsaverage).
      </p>
    </div>
  );
}
