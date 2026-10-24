import { Link } from "react-router-dom";
import { useStore } from "../store";
import { StudyCard } from "../components/StudyCard";
import { IconBookmark } from "../icons";

export function Saved() {
  const { saved } = useStore();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brain-explorer-saved-studies.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="eyebrow">Saved studies</div>
          <h1>Your reading list</h1>
          <p>Saved in this browser only (localStorage). Nothing is uploaded. Clearing your browser data removes this list.</p>
        </div>
        {saved.length > 0 && <button className="btn" onClick={exportJson}>Export as JSON</button>}
      </header>
      {saved.length === 0 ? (
        <div className="panel empty">
          <IconBookmark size={30} />
          <p>No saved studies yet.</p>
          <p className="small faint" style={{ marginTop: 4 }}>Use the Save button on any study.</p>
          <Link className="btn primary" to="/library" style={{ marginTop: 14 }}>Browse the library</Link>
        </div>
      ) : (
        <div className="stack-sm">
          {saved.map((r) => <StudyCard key={r.id} record={r} />)}
        </div>
      )}
    </div>
  );
}
