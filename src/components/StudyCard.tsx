import { Link } from "react-router-dom";
import type { ResearchRecord } from "../../shared/types";
import { useStore } from "../store";
import { EvidenceChips, formatAuthors, sourceLinkLabel } from "./Evidence";
import { IconBookmark, IconBookmarkFilled, IconExternal } from "../icons";

export function SaveButton({ record, small = false }: { record: ResearchRecord; small?: boolean }) {
  const { isSaved, toggleSaved } = useStore();
  const saved = isSaved(record.id);
  return (
    <button
      className={`btn ${small ? "sm" : ""} ${saved ? "" : "ghost"}`}
      aria-pressed={saved}
      onClick={() => toggleSaved(record)}
      title={saved ? "Remove from saved studies" : "Save this study"}
    >
      {saved ? <IconBookmarkFilled size={15} /> : <IconBookmark size={15} />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}

export function StudyCard({ record, index, highlight }: { record: ResearchRecord; index?: number; highlight?: boolean }) {
  const preview = record.abstract.map((s) => s.text).join(" ");
  return (
    <article className={`panel study-card fade-in${highlight ? " highlight" : ""}`} id={`study-${record.id}`}>
      <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
        {index !== undefined && <span className="study-index" style={{ marginTop: 3 }}>[{index}]</span>}
        <div className="grow">
          <h3>
            <Link to={`/study/${encodeURIComponent(record.id)}`}>{record.title}</Link>
          </h3>
          <div className="meta">
            {formatAuthors(record)} · <em>{record.journal ?? "Journal not listed"}</em> · {record.publicationDate ?? "Date not reported"}
          </div>
          {preview && <p className="abstract">{preview}</p>}
          <div className="row wrap" style={{ marginTop: 10, justifyContent: "space-between" }}>
            <EvidenceChips record={record} />
            <div className="row" style={{ gap: 4 }}>
              <a className="btn sm ghost" href={record.sourceUrl} target="_blank" rel="noreferrer" title={`Open on ${sourceLinkLabel(record)}`}>
                {sourceLinkLabel(record)} <IconExternal size={13} />
              </a>
              <SaveButton record={record} small />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function StudyCardSkeleton() {
  return (
    <div className="panel study-card">
      <div className="skeleton" style={{ height: 16, width: "80%" }} />
      <div className="skeleton" style={{ height: 12, width: "50%", marginTop: 10 }} />
      <div className="skeleton" style={{ height: 40, width: "100%", marginTop: 12 }} />
    </div>
  );
}
