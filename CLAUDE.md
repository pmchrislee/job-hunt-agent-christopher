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
| `job_search_profile.md` | Target criteria: Software Engineer, SF Bay Area, high tech, $200k+ |
| `weekly_job_hunt_workflow.md` | Repeatable weekly steps to research, apply, and follow up |
| `job_leads.md` | Running log of leads, statuses, comp ranges, and notes |
| `weekly_run_prompt.md` | Reusable prompt to paste at the start of each weekly session |
| `resume.md` | Christopher's full resume — source of truth for cover letter generation |
| `cover_letter_prompt.md` | Template prompt for generating tailored cover letters |
| `scrape_jobs.ts` | Bun script that queries Claude to surface new job leads and appends them to `job_leads.md` |
| `cover_letters/` | Generated cover letters saved as `[company]-[role].md` |

Each weekly session: run `bun run scrape_jobs.ts` → review new leads → generate cover letters using `cover_letter_prompt.md` → update `job_leads.md` statuses → summarize.

## Commands

```bash
bun run scrape_jobs.ts          # Search for new leads and append to job_leads.md
bun test                        # Run tests
```
