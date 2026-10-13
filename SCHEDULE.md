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

---

# Scheduling the daily run

`daily_run.ts` runs `scrape_jobs.ts`, then `draft_cover_letters.ts`, then emails the action
digest from `daily_digest.ts`. It prepares applications and lists them for review. **It never
submits an application or sends outreach** (see `agent_system_prompt.md` Rule 4).

## Before scheduling it

- `ANTHROPIC_API_KEY` in `.env` must be a working key, or the scrape and drafting steps fail.
  The digest still goes out and reports the failure.
- `GMAIL_APP_PASSWORD` in `.env` must be set, or the digest is printed to the log only.
- Check with `bun run daily --dry-run` (prints the digest; no scrape, no drafting, no email).

## Cost of running daily

Each run uses up to `WEEKLY_QUERY_BUDGET` (4) search queries, so a daily schedule uses up to
about 120 a month, plus one Claude call to score leads and one per cover letter drafted.
Check that against your SerpAPI or SearchAPI plan. Do not also install the weekly cron line above, or the scraper runs twice on Mondays.

## Installed schedule (every day at 5:00 AM)

The daily run is installed as a macOS LaunchAgent, not a crontab entry. cron skips a job
when the Mac is asleep at the scheduled time; launchd runs it once the Mac next wakes.

- Job file: `~/Library/LaunchAgents/com.pmchrislee.job-hunt-daily.plist`
- Log: `daily.log` in this folder (ignored by git)
- If the Anthropic key is rejected, the run skips the scrape and drafting, so no search
  queries are spent, and the digest reports the problem.

Check it:

```bash
launchctl print gui/$(id -u)/com.pmchrislee.job-hunt-daily
```

Run it now:

```bash
launchctl kickstart gui/$(id -u)/com.pmchrislee.job-hunt-daily
```

Turn it off:

```bash
launchctl bootout gui/$(id -u)/com.pmchrislee.job-hunt-daily
```

To change the time, edit `Hour` and `Minute` in the job file, then turn it off and load it
again with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.pmchrislee.job-hunt-daily.plist`.
