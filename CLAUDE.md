# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI-powered job hunt agent for Christopher Lee. Automates job research, application drafting, tracking, and follow-ups using the Claude API.

## Stack

- **Runtime:** Bun
- **AI:** Claude API via `@anthropic-ai/sdk` (default model: `claude-sonnet-4-6`)
- **Storage:** Local files for application tracking

## Key Files

| File | Purpose |
|------|---------|
| `job_search_profile.md` | Target criteria: Senior SWE, SF Bay Area or NYC, tech consulting, hybrid, $200k+ base, Series B+, no sponsorship needed. Passive search — currently employed, keep discreet. |
| `weekly_job_hunt_workflow.md` | 12-step numbered procedure: load profile → check resume fits target roles → scrape → filter → append → backfill dates → triage statuses → research/qualify → generate cover letters → log submissions → draft follow-ups → print summary. Enforces a "passive bar" (must clearly beat comp floor, not just meet it) and a discretion constraint (currently-employed, no public signals) inline at each relevant step. |
| `job_leads.md` | Pipeline table of leads (see schema below) |
| `weekly_run_prompt.md` | Prompt to paste at the start of each Monday session; kicks off the workflow and pauses for Christopher's input at decision points |
| `resume.md` | Source of truth for cover letter generation |
| `cover_letter_prompt.md` | Template/guidelines for tailored cover letters (3–4 paragraphs, <350 words, no "I am excited to apply") |
| `scrape_jobs.ts` | Bun script that queries Claude to surface new job leads and appends them to `job_leads.md` |
| `cover_letters/` | Generated cover letters saved as `[company]-[role].md` (empty as of last check) |

### `job_leads.md` schema
Columns: `Source | Role | Company | Location | Link | MatchReason | Notes | OutreachStatus`.

- `OutreachStatus` is the workflow's "status" field — values in use: `New`, `Researching` (also referenced by the workflow but not yet seen in data: `Ready`, `Applied`, `Stale`, `Skip`, `Interview`, `Offer`).
- `Notes` currently holds research/match findings, not dates. The workflow (Step 2, Step 6) assumes submission/staleness dates live in `Notes` — when logging applications or triaging, append the date explicitly (e.g. "Applied 2026-07-20") so those steps have something to parse.
- No `## Active Priorities` or `## Archive` sections exist yet — the workflow creates them on first use (Steps 2 and 5).

### Running a session
Paste `weekly_run_prompt.md`, or manually: work through `weekly_job_hunt_workflow.md` steps 1–12 in order (steps 1–2 load the profile and flag any profile/resume conflict before touching leads). Note `weekly_run_prompt.md`'s own Step 1 profile-check duplicates the workflow's steps 1–2 — harmless overlap, but worth collapsing if the prompt is ever rewritten.

## Commands

```bash
bun run scrape_jobs.ts          # Search for new leads and append to job_leads.md
bun test                        # Run tests
```
