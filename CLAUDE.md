# Brain Explorer — notes for Claude Code

Student project (Congressional App Challenge). The owner is a beginner programmer: explain decisions in plain language.

## Stack
- Front end: React 18 + TypeScript + Vite (`src/`), Three.js brain in `src/brain/scene.ts`.
- Back end: Express 5 + TypeScript run with `tsx` (`server/`). Entry `server/index.ts`, app factory `server/app.ts`.
- Shared types + region dictionary: `shared/`.
- Tests: Vitest (`tests/`). Run `npm test` and `npm run typecheck` before declaring work done.

## Non-negotiable rules
- Never fabricate studies, citations, PMIDs, sample sizes, brain maps or measurements — including in seed data, examples, or UI copy.
- Test fixtures must be visibly synthetic (`[TEST FIXTURE]` titles, PMIDs ≥ 90000000) and must never be loaded by the app.
- Every derived field carries a `provenance`. Missing data stays missing ("Not reported").
- AI output must pass `server/ai/validate.ts`; don't bypass it. Brain-map availability comes only from `server/maps/neurovault.ts`, never from the model.
- Secrets live only in server-side env vars (`server/config.ts`). Never send them to the browser or commit `.env`.
- The 3D model is a schematic placeholder: keep it labeled, and don't render statistical maps on it.

## Claude API
- `server/ai/claude.ts`: `client.beta.messages.parse` + `zodOutputFormat(ModelAnswerSchema)`, model `claude-opus-5-5`, `output_config.effort: "high"`, `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`. Handle `stop_reason` refusal/max_tokens before reading output.
