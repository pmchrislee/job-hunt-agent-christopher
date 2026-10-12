# Plan: Health-check endpoint

## Files to change
- `health_server.ts` (new) — standalone `Bun.serve` app; no existing file touched since no server currently exists in this repo.
- `health_server.test.ts` (new) — automated coverage for the route.
- `package.json` — add `"health-server"` and `"test"` scripts only; no existing script edited.

## Behavior to implement
- `GET /health` → `200`, `Content-Type: application/json`, body exactly `{"status":"ok"}`.
- Any other path → `404`.
- Route logic exported as a plain `handleRequest(req): Response` function so it's callable directly in tests without binding a port; server only starts listening when the file is run directly.

## Tests to run or add
- Add `health_server.test.ts` (`bun:test`):
  - `/health` returns `200`.
  - `/health` `Content-Type` contains `application/json`.
  - `/health` body deep-equals `{ status: "ok" }`.
  - An unmatched path returns `404`.
- Run: `bun test` (whole suite — confirms nothing else broke; there are no prior tests to regress).

## Risk / open question to validate before coding
No service in this repo runs continuously today (`scrape_jobs.ts` / `draft_cover_letters.ts` are one-shot CLI scripts), so there's no existing consumer for a health check. Before writing code: confirm whether this endpoint needs to be reachable by something real (a monitor, a future always-on service) — if not, it's speculative scope for a repo that's otherwise deliberately kept low-profile (per `agent_system_prompt.md`'s discretion constraint).
