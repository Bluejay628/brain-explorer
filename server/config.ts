import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// All secrets come from environment variables (a local `.env` file during
// development). Nothing in this file is ever sent to the browser — the
// /api/status endpoint only reports whether a key is *configured*, never its value.

const here = path.dirname(fileURLToPath(import.meta.url));

function clean(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

export const config = {
  port: Number(clean(process.env.PORT) ?? 8787),
  anthropicApiKey: clean(process.env.ANTHROPIC_API_KEY),
  claudeModel: clean(process.env.CLAUDE_MODEL) ?? "claude-opus-5-5",
  ncbiApiKey: clean(process.env.NCBI_API_KEY),
  ncbiEmail: clean(process.env.NCBI_EMAIL),
  ncbiTool: clean(process.env.NCBI_TOOL) ?? "brain-explorer",
  /** Contact email sent to research APIs that ask for one (OpenAlex "polite pool", NCBI). */
  contactEmail: clean(process.env.CONTACT_EMAIL) ?? clean(process.env.NCBI_EMAIL),
  semanticScholarApiKey: clean(process.env.SEMANTIC_SCHOLAR_API_KEY),
  dataDir: clean(process.env.DATA_DIR) ?? path.resolve(here, "../data"),
  isProduction: process.env.NODE_ENV === "production",
};
