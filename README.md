# Job Hunt Agent

A personal job hunt agent built on Bun, TypeScript, and the Claude API. It finds new job
postings, filters them against a written profile, tracks them in a markdown pipeline, and
drafts cover letters and outreach for review.

It never applies or sends outreach on its own. Everything it writes is a draft; submitting is a
human step.

## How it works

1. `job_search_profile.md` defines what to look for: target roles, locations, industries,
   compensation floor, and hard constraints.
2. `bun run scrape` searches job boards and company career pages, scores the results against
   the profile and `resume.md`, and appends new leads to `job_leads.md`.
3. `weekly_job_hunt_workflow.md` is the 12-step weekly procedure an agent (Claude Code) follows
   to filter, research, qualify, and triage those leads.
4. `bun run draft-cover-letters` drafts a cover letter for each qualifying lead into
   `cover_letters/`.

## Key files

| File | Purpose |
|------|---------|
| `job_search_profile.md` | Search criteria. Read fresh on every run. |
| `weekly_job_hunt_workflow.md` | The weekly workflow: purpose, inputs, outputs, and actions for each step. |
| `weekly_run_prompt.md` | The prompt to paste into Claude Code to start a weekly session. |
| `job_leads.md` | The lead pipeline, one table row per lead with notes and status. |
| `resume.md` | The only source for claims about experience. |
| `cover_letter_prompt.md` | Guidelines for cover letter drafts. |
| `agent_system_prompt.md` | Standing rules for the agent. |
| `scrape_jobs.ts` | Lead search and scoring. |
| `draft_cover_letters.ts` | Batch cover letter drafting. |
| `daily_run.ts` | Daily run: scrape, draft cover letters, email the action digest. |
| `daily_digest.ts` | Builds the daily email of actions to review. |
| `SCHEDULE.md` | How to schedule the daily or weekly run with cron. |
| `CLAUDE.md` | Project guide for Claude Code. |

## Setup

Requires [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env
```

Fill in `.env`:

| Variable | Needed for |
|----------|------------|
| `ANTHROPIC_API_KEY` | Scoring leads and drafting text |
| `SERPAPI_KEY` or `SEARCHAPI_KEY` | Job search; at least one is required |
| `GMAIL_APP_PASSWORD` | Emailing the daily digest and run summary to the owner; without it they only print |

`.env` is ignored by git. Never commit it.

## Usage

```bash
bun run scrape                          # find new leads and append them to job_leads.md
bun run draft-cover-letters --dry-run   # list the leads that would get a cover letter
bun run draft-cover-letters             # draft the cover letters
bun run daily                           # scrape, draft, and email the daily action digest
bun run digest --dry-run                # print today's digest without sending
bun test                                # run tests
```

For a full weekly session, open the project in Claude Code and paste the block from
`weekly_run_prompt.md`.

## Lead statuses

`New` → `Researching` → `Ready` → `Applied` → `Interview` → `Offer`, with `Skip` for leads that
fail the profile and `Stale` for applications with no response.
