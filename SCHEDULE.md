# Scheduling scrape_jobs.ts

`scrape_jobs.ts` fetches new leads (SerpAPI/SearchAPI + direct ATS), scores/appends them to
`job_leads.md`, drafts one outreach email for the strongest undrafted lead (if any) to
`outreach/`, and emails a run summary to pmchrislee@gmail.com.

**It never sends outreach on its own.** Drafts are files for you to review and send yourself —
see `agent_system_prompt.md` Rule 4. The only email it sends automatically is the internal
usage/report summary (leads added, API cost, which draft file if any), not outreach.

## What it reads live (no hardcoded profile to go stale)

- `job_search_profile.md` — Target Roles, Target Locations, Compensation floor
- `resume.md` — grounds both lead scoring and outreach drafting; nothing is fabricated beyond
  what's actually in this file
- `agent_system_prompt.md` — standing rules, fed into the outreach-drafting prompt

Edit those files any time; the next run picks up the change automatically.

## Costs per run (see COST constants in scrape_jobs.ts)

- Up to `WEEKLY_QUERY_BUDGET` (4) SerpAPI/SearchAPI queries — ~$0.005 each
- One Claude call to score/filter leads, one more to draft outreach (only if a lead qualifies)
- Full breakdown logged to `usage_log.json` every run, and included in the report email

## Setup

```bash
cd /Users/christopherlee/job-hunt-agent-christopher
which bun   # confirm bun's absolute path for the cron line below
```

## Cron line

Cron runs with a minimal environment and no shell profile, so use bun's absolute path and `cd`
into the project first (the script also explicitly loads `.env` from its own directory
regardless of cwd, so that part is covered either way):

```cron
0 8 * * 1 cd /Users/christopherlee/job-hunt-agent-christopher && /path/to/bun run scrape_jobs.ts >> /Users/christopherlee/job-hunt-agent-christopher/cron.log 2>&1
```

(`0 8 * * 1` = every Monday at 8:00 AM. Adjust the schedule as needed.)

## Install

```bash
crontab -e
```

Paste the line above (with bun's real path substituted in), save, and exit.

## Verify it's installed

```bash
crontab -l
```

## Uninstall

```bash
crontab -e
```

Delete the line, save, and exit.
