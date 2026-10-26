# Brain Explorer — notes for Claude Code

Student project (Congressional App Challenge). The owner is a beginner programmer: explain decisions in plain language.

## Stack
- Front end: React 18 + TypeScript + Vite (`src/`). One page (`src/App.tsx`) with top tabs kept in the URL (`src/nav.ts`). Three.js brain in `src/brain/scene.ts`; Cells tab in `src/cells/`.
- Back end: Express 5 + TypeScript run with `tsx` (`server/`). Entry `server/index.ts`, app factory `server/app.ts`.
- Shared types + region dictionary: `shared/`.
- Tests: Vitest (`tests/`). Run `npm test` and `npm run typecheck` before declaring work done.

## Non-negotiable rules
- Never fabricate studies, citations, PMIDs, sample sizes, brain maps or measurements — including in seed data, examples, or UI copy.
- Test fixtures must be visibly synthetic (`[TEST FIXTURE]` titles, PMIDs ≥ 90000000) and must never be loaded by the app.
- Every derived field carries a `provenance`. Missing data stays missing ("Not reported").
- Brain-cell numbers come only from `public/data/cell-atlas.json` (Allen Brain Cell Atlas, built by `scripts/build-cell-atlas.py`). Region ↔ sample links live in `shared/cellAtlas.ts`; unmatched parts show no data, never an estimate.
- AI output must pass `server/ai/validate.ts`; don't bypass it. Brain-map availability comes only from `server/maps/neurovault.ts`, never from the model.
- Secrets live only in server-side env vars (`server/config.ts`). Never send them to the browser or commit `.env`.
- The 3D model is an AVERAGE brain (fsaverage5, built by scripts/build-brain-model.py). The character is fictional: never present group findings as facts about him; hormones only when asked.

## Claude API
- `server/ai/claude.ts`: `client.beta.messages.parse` + `zodOutputFormat(ModelAnswerSchema)`, model `claude-opus-5-5`, `output_config.effort: "high"`, `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`. Handle `stop_reason` refusal/max_tokens before reading output.
