/**
 * Minimal health-check server.
 *
 * This repo has no pre-existing HTTP server — the rest of the codebase is
 * standalone Bun scripts (scrape_jobs.ts, draft_cover_letters.ts) run
 * directly from the CLI. This file adds a small, separate Bun.serve app
 * exposing a single GET /health endpoint, without touching those scripts.
 *
 * The route handler is exported standalone (`handleRequest`) so tests can
 * call it directly without binding a port.
 *
 * Usage:
 *   bun run health_server.ts       # starts the server (default port 3000,
 *                                  # override with PORT env var)
 */

export function handleRequest(req: Request): Response {
  const { pathname } = new URL(req.url);

  if (pathname === "/health") {
    return Response.json({ status: "ok" });
  }

  return new Response("Not Found", { status: 404 });
}

const PORT = Number(process.env.PORT) || 3000;

// Only start listening when this file is run directly (e.g. `bun run
// health_server.ts`), not when imported by tests.
if (import.meta.main) {
  const server = Bun.serve({
    port: PORT,
    fetch: handleRequest,
  });
  console.log(`Health server listening on http://localhost:${server.port}`);
}
