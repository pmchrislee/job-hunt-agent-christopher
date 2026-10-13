# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

This repo is an AI-powered job hunt agent for Christopher Lee. It automates job research, application drafting, tracking, and follow-ups using the Claude API.

## Stack

- **Runtime:** Bun
- **AI:** Claude API via `@anthropic-ai/sdk` (default model: `claude-sonnet-4-6`)
- **Storage:** Local files for application tracking

## Key Files

| File | Purpose |
|------|---------|
| `job_search_profile.md` | Target criteria: roles, work arrangement, locations, industries, comp floor, search urgency, hard constraints (including keeping the search discreet). Read it fresh each run; `scrape_jobs.ts` parses its `##` headings, so keep them as named. |
| `weekly_job_hunt_workflow.md` | 12-step weekly procedure, each step with purpose, inputs, outputs, and actions: load profile → check resume → scrape → filter → stamp dates → backfill dates → triage statuses → research/qualify → draft cover letters → log submissions → draft follow-ups → print summary. Holds no criteria of its own; everything is read from the profile. Stops for Christopher at steps 2, 10, and 11. |
| `job_leads.md` | Pipeline table of leads (see schema below) |
| `weekly_run_prompt.md` | Prompt to paste at the start of each Monday session; kicks off the workflow and pauses for Christopher's input at decision points |
| `resume.md` | Source of truth for cover letter generation |
| `cover_letter_prompt.md` | Template/guidelines for tailored cover letters (3–4 paragraphs, <350 words, no "I am excited to apply") |
| `scrape_jobs.ts` | Bun script that queries Claude to surface new job leads and appends them to `job_leads.md` |
| `draft_cover_letters.ts` | Bun script that drafts a cover letter for each `New`, `Researching`, or `Ready` lead using `resume.md` and `cover_letter_prompt.md` |
| `cover_letters/` | Generated cover letters saved as `[company]-[role].md` |
| `daily_run.ts` | Daily run: scrape, draft cover letters, review the resume, then email the action digest. Prepares applications for review; never submits one |
| `daily_digest.ts` | Builds and emails the daily list of actions to review (apply, review, outreach, follow up, stale). `--dry-run` prints without sending |
| `resume_review.ts` | Compares `resume.md` with the open leads and writes suggested changes to `resume_suggestions.md` (ignored by git). Suggestions only; it never edits the resume. Skips the Claude call when the resume and leads are unchanged |

### `job_leads.md` schema
Columns: `Source | Role | Company | Location | Link | MatchReason | Notes | OutreachStatus`.

- `OutreachStatus` is the workflow's "status" field — values in use: `New`, `Researching` (also referenced by the workflow but not yet seen in data: `Ready`, `Applied`, `Stale`, `Skip`, `Interview`, `Offer`).
- `Notes` currently holds research/match findings, not dates. The workflow (Step 2, Step 6) assumes submission/staleness dates live in `Notes` — when logging applications or triaging, append the date explicitly (e.g. "Applied 2026-07-20") so those steps have something to parse.
- No `## Active Priorities` or `## Archive` sections exist yet — the workflow creates them on first use (Steps 2 and 5).

### Running a session
Paste `weekly_run_prompt.md`, or manually: work through `weekly_job_hunt_workflow.md` steps 1–12 in order (steps 1–2 load the profile and flag any profile/resume conflict before touching leads). Note `weekly_run_prompt.md`'s own Step 1 profile-check duplicates the workflow's steps 1–2 — harmless overlap, but worth collapsing if the prompt is ever rewritten.

## Commands

```bash
bun run scrape                  # Search for new leads and append to job_leads.md
bun run draft-cover-letters     # Draft cover letters into cover_letters/
bun run daily                   # Scrape, draft, and email the daily action digest
bun run digest --dry-run        # Print today's digest without sending
bun run resume-review           # Suggest resume changes based on the open leads
bun test                        # Run tests
```

## Resume suggestions

Whenever leads are added or reviewed, compare `resume.md` with what the open leads ask for and tell Christopher what to change, without being asked. Suggest only; change `resume.md` when he says to, and never add experience, tools, or metrics he has not confirmed.
