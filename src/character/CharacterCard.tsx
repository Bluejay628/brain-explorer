import { useId } from "react";
import { useStore } from "../store";
import { AGE_GROUP_LABEL, AGE_MAX, AGE_MIN, ageGroupForAge, personNoun } from "../../shared/lifeStage";

/** Minimal line-art bust. Younger: bigger head, narrower shoulders. Older: hair turns gray. */
export function CharacterAvatar({ age, size = 120 }: { age: number; size?: number }) {
  const t = Math.min(1, Math.max(0, (age - 3) / 17)); // growth from 3 to ~20
  const gray = Math.min(1, Math.max(0, (age - 50) / 30)); // graying from 50 to 80
  const hairFill = `rgb(${Math.round(29 + gray * 120)}, ${Math.round(42 + gray * 112)}, ${Math.round(68 + gray * 90)})`;
  const head = 34 - t * 4; // head radius
  const shoulders = 52 + t * 30;
  const neck = 10 + t * 6;
  const cy = 70;
  const neckTop = cy + head * 1.12;
  const shoulderY = neckTop + neck;
  const gid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 200 220" role="img" aria-label={`Illustration of the character, age ${age}`}>
      <defs>
        <radialGradient id={`${gid}-g`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#3fd6ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3fd6ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy={cy} r={head + 26} fill={`url(#${gid}-g)`} />
      {/* shoulders */}
      <path d={`M ${100 - shoulders} 220 C ${100 - shoulders} ${shoulderY + 18}, ${100 - shoulders * 0.55} ${shoulderY}, 88 ${shoulderY} L 112 ${shoulderY} C ${100 + shoulders * 0.55} ${shoulderY}, ${100 + shoulders} ${shoulderY + 18}, ${100 + shoulders} 220`} fill="rgba(12,19,34,.9)" stroke="#5f7aa8" strokeWidth="1.6" />
      {/* collar */}
      <path d={`M 88 ${shoulderY} L 100 ${shoulderY + 14} L 112 ${shoulderY}`} fill="none" stroke="#5f7aa8" strokeWidth="1.4" />
      {/* neck */}
      <path d={`M 91 ${neckTop - 4} L 91 ${shoulderY} M 109 ${neckTop - 4} L 109 ${shoulderY}`} stroke="#8fa6cf" strokeWidth="1.6" />
      {/* head */}
      <ellipse cx="100" cy={cy} rx={head * 0.86} ry={head * 1.12} fill="rgba(8,13,24,.95)" stroke="#8fa6cf" strokeWidth="1.8" />
      {/* ears */}
      <path d={`M ${100 - head * 0.86} ${cy} q -7 4 0 14 M ${100 + head * 0.86} ${cy} q 7 4 0 14`} fill="none" stroke="#8fa6cf" strokeWidth="1.6" />
      {/* hair */}
      <path d={`M ${100 - head * 0.88} ${cy - 2} C ${100 - head} ${cy - head * 1.25}, ${100 + head * 0.7} ${cy - head * 1.45}, ${100 + head * 0.9} ${cy - 6} C ${100 + head * 0.5} ${cy - head * 0.75}, ${100 - head * 0.2} ${cy - head * 0.6}, ${100 - head * 0.88} ${cy - 2} Z`} fill={hairFill} stroke="#8fa6cf" strokeWidth="1.4" />
      {/* brain glyph inside the head */}
      <g transform={`translate(100 ${cy - head * 0.42}) scale(${(head / 34) * 0.62})`} fill="none" stroke="#3fd6ff" strokeWidth="1.4" strokeLinecap="round" opacity="0.95">
        <path d="M0 -14 C -6 -18 -16 -16 -17 -8 C -23 -6 -23 4 -17 6 C -17 13 -8 16 0 12 C 8 16 17 13 17 6 C 23 4 23 -6 17 -8 C 16 -16 6 -18 0 -14 Z" />
        <path d="M0 -14 V 12 M -9 -6 C -5 -5 -5 0 -9 1 M 9 -6 C 5 -5 5 0 9 1" />
      </g>
    </svg>
  );
}

export function CharacterCard({ compact = false }: { compact?: boolean }) {
  const { character, updateCharacter } = useStore();
  const ageId = useId();
  const nameId = useId();
  const group = ageGroupForAge(character.age);
  return (
    <div className="character-card panel panel-pad">
      <div className="row character-row" style={{ alignItems: "center", gap: 16 }}>
        <CharacterAvatar age={character.age} size={compact ? 76 : 96} />
        <div className="grow stack-sm">
          <div className="row wrap" style={{ gap: 8 }}>
            <label htmlFor={nameId} className="sr-only">Character name</label>
            <input
              id={nameId}
              className="name-input"
              value={character.name}
              onChange={(e) => updateCharacter({ name: e.target.value })}
              maxLength={24}
              aria-label="Character name"
            />
            <span className="chip">{character.age} years old · {personNoun(character.age)}</span>
            <span className="chip cyan">{AGE_GROUP_LABEL[group]}</span>
          </div>
          <label htmlFor={ageId} className="field">
            <span className="row wrap" style={{ justifyContent: "space-between", rowGap: 4 }}>
              <span>Age (drag to change)</span>
              <span className="row wrap" style={{ gap: 4 }}>
                {[5, 10, 16, 30, 50, 75].map((a) => (
                  <button key={a} type="button" className="btn sm ghost age-preset" aria-pressed={character.age === a} onClick={() => updateCharacter({ age: a })}>{a}</button>
                ))}
              </span>
            </span>
            <input
              id={ageId}
              type="range"
              min={AGE_MIN}
              max={AGE_MAX}
              value={character.age}
              onChange={(e) => updateCharacter({ age: Number(e.target.value) })}
              className="age-slider"
            />
          </label>
          <label className="check xs">
            <input type="checkbox" checked={character.includeHormones} onChange={(e) => updateCharacter({ includeHormones: e.target.checked })} />
            Also explain hormones (cortisol, melatonin, testosterone…)
          </label>
        </div>
      </div>
      {!compact && (
        <p className="xs faint" style={{ marginTop: 10 }}>
          {character.name || "This character"} is fictional. His brain shows what research suggests <em>typically</em> happens in people his age —
          real brains vary, and studies describe groups, not one person. The 3D model is an average brain, not a scan of him.
        </p>
      )}
    </div>
  );
}
