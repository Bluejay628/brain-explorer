import { dayForAge, scenariosForAge, type Scenario, type TimelineEvent } from "./scenarios";

interface Props {
  onRun: (item: Scenario | TimelineEvent) => void;
  activeSituation?: string;
  busy?: boolean;
  name: string;
  age: number;
}

export function SituationGrid({ onRun, activeSituation, busy, name, age }: Props) {
  return (
    <div className="stack-sm">
      <p className="small dim">Pick a situation to see what research suggests happens in {name}'s brain.</p>
      <div className="situation-grid">
        {scenariosForAge(age).map((s) => (
          <button
            key={s.id}
            className="situation"
            aria-pressed={activeSituation === s.situation}
            disabled={busy}
            onClick={() => onRun(s)}
            title={s.note}
          >
            <span className="situation-title">{s.title}</span>
            <span className="xs faint">Research focus: {s.focus}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DayTimeline({ onRun, activeSituation, busy, name, age }: Props) {
  return (
    <div className="stack-sm">
      <p className="small dim">A typical day for {name} at age {age}. Click a moment to see what research says about his brain then.</p>
      <ol className="timeline">
        {dayForAge(age).map((e) => (
          <li key={e.time}>
            <button className="timeline-item" aria-pressed={activeSituation === e.situation} disabled={busy} onClick={() => onRun(e)}>
              <span className="mono timeline-time">{e.time}</span>
              <span className="timeline-dot" aria-hidden="true" />
              <span className="grow">
                <span className="situation-title">{e.title}</span>
                <span className="xs faint" style={{ display: "block" }}>Research focus: {e.focus}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="xs faint">The schedule is an example to explore with, not data about a real person. It changes with his age.</p>
    </div>
  );
}
