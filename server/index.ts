import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Brain Explorer ${config.isProduction ? "website + API" : "API (dev mode)"} running at http://localhost:${config.port}`);
  console.log(`  AI engine: ${config.anthropicApiKey ? `configured (${config.claudeModel})` : "NOT configured — retrieval-only mode (set ANTHROPIC_API_KEY in .env)"}`);
  console.log(`  NCBI API key: ${config.ncbiApiKey ? "configured" : "not set (limited to 3 requests/second)"}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${config.port} is already in use. Stop the other copy (Ctrl+C in its terminal) or set PORT=8788 in .env.`);
  } else {
    console.error(`Server failed to start: ${err.message}`);
  }
  process.exit(1);
});
