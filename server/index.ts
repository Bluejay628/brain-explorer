import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();
app.listen(config.port, () => {
  console.log(`Brain Explorer API listening on http://localhost:${config.port}`);
  console.log(`  AI engine: ${config.anthropicApiKey ? `configured (${config.claudeModel})` : "NOT configured — retrieval-only mode (set ANTHROPIC_API_KEY in .env)"}`);
  console.log(`  NCBI API key: ${config.ncbiApiKey ? "configured" : "not set (limited to 3 requests/second)"}`);
});
