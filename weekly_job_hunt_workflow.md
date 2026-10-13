# Weekly Job Hunt Workflow

Run every Monday, steps 1 to 12 in order. Do not skip steps.

## Ground rules (apply to every step)

- **Criteria come from `job_search_profile.md`, read fresh each run.** Nothing in this file
  restates roles, locations, comp, or constraints. If a value below looks hardcoded, the
  profile wins.
- **Claims about Christopher come only from `resume.md`.** Never invent or stretch a title,
  metric, or skill.
- **Discretion.** Christopher is employed. Never suggest or take an action visible to his
  employer or network (no "open to work" signals, no posts, no outreach through shared
  channels).
- **Nothing is sent or submitted by the agent.** Cover letters, outreach, and follow-ups are
  drafts. Submitting an application needs Christopher's explicit yes for that one application.
- **Dates.** Write every date as `YYYY-MM-DD`. Every status change appends a dated note to the
  row's Notes, e.g. `Applied 2026-10-12`.
- **Statuses** (`OutreachStatus` column): `New`, `Researching`, `Ready`, `Applied`, `Stale`,
  `Skip`, `Interview`, `Offer`.
- **Stop points.** Steps 2, 10, and 11 wait for Christopher. Do not guess past them.

---

## Step 1: Load the profile

**Purpose:** Fix this week's criteria before touching any lead.

**Inputs:** `job_search_profile.md`

**Outputs:** A criteria list held for the rest of the run: Target Roles, Work Arrangement,
Target Locations, Industries & Companies, Compensation floor and range rule, Search Urgency,
Hard Constraints.

**Actions:**
1. Read the whole file.
2. Extract each section listed above, word for word.
3. Note the urgency mode. `Actively searching` means meeting a minimum is enough. `Passive`
   means a lead must clearly beat the minimums, with a written reason.
4. If a section is missing or empty, stop and ask Christopher to fill it in.

## Step 2: Check the resume against the target roles

**Purpose:** Catch a profile and resume mismatch before spending search budget on it.

**Inputs:** Criteria from step 1, `resume.md`

**Outputs:** Either "resume supports target roles" or a conflict note carried to step 12.

**Actions:**
1. Read `resume.md`.
2. For each Target Role, find at least one title or body of experience on the resume that
   supports it.
3. If any Target Role has no support, stop. Tell Christopher which role, what the resume shows
   instead, and ask whether to change the profile, change the resume, or proceed anyway.
4. Continue only after he answers. Record his answer for the summary.

## Step 3: Scrape new leads

**Purpose:** Pull this week's new postings into the pipeline.

**Inputs:** `job_search_profile.md`, `resume.md`, `seen_jobs.json`, API keys in `.env`

**Outputs:** New rows appended to `job_leads.md` with `OutreachStatus = New`; updated
`seen_jobs.json` and `usage_log.json`; possibly one outreach draft in `outreach/`.

**Actions:**
1. Copy the current row count of `job_leads.md` so new rows can be identified afterwards.
2. Run `bun run scrape` from the project folder.
3. If it fails, report the error text and continue from step 6 with existing leads. Do not
   retry more than once; each run spends search API budget.
4. List the rows the script added. These are "this week's new rows".

## Step 4: Filter this week's new rows

**Purpose:** Remove leads that plainly fail the profile before any research time is spent.

**Inputs:** This week's new rows, criteria from step 1

**Outputs:** Each new row either left as `New` or set to `Skip` with a reason.

**Actions:** For each new row, set `OutreachStatus = Skip` and append `Skip <date>: <reason>`
to Notes if any of these is true:
1. The title is not one of the Target Roles.
2. The location is not one of the Target Locations.
3. It fails a Hard Constraint.
4. It is an obvious mismatch for Industries & Companies. If unsure, keep it for step 8.
5. Comp is listed and fails the Compensation floor under the profile's range rule and the
   urgency mode from step 1. If comp is not listed, keep it.
6. The same Company, Role, and Link already exist in another row.

Do not filter on Work Arrangement unless the profile restricts it.

## Step 5: Stamp the surviving new rows

**Purpose:** Give every new lead a date so later steps can age it.

**Inputs:** New rows still marked `New`

**Outputs:** Each has `Found <date>` in Notes.

**Actions:**
1. Append `Found <today>` to Notes on each surviving new row.
2. Leave the script's own Notes text in place.

## Step 6: Backfill missing dates

**Purpose:** Make every row in the pipeline datable.

**Inputs:** All rows in `job_leads.md`

**Outputs:** No row without at least one date in Notes.

**Actions:**
1. Scan every row.
2. Where Notes has no date, append `Found <best estimate> (estimated)`. Use `git log` on
   `job_leads.md` to find when the row first appeared; fall back to today.

## Step 7: Triage statuses

**Purpose:** Keep the pipeline current and surface what matters.

**Inputs:** All rows, their dated Notes, today's date, criteria from step 1

**Outputs:** Updated statuses; `## Active Priorities` and `## Archive` sections kept current.

**Actions:**
1. Any `New`, `Researching`, or `Ready` row that no longer matches the current profile (for
   example after a profile change): set `Skip` with `Skip <date>: no longer matches profile`.
2. `New` with its latest date 5 or more days old: set `Researching`.
3. `Applied` with no response recorded for 21 or more days: set `Stale`.
4. `Stale` for 10 or more further days: move the row to a `## Archive` section at the bottom
   of the file. Create the section, with the table header, if it does not exist.
5. `Interview` or `Offer`: copy the row into a `## Active Priorities` section at the top of
   the file. Create it if it does not exist.

## Step 8: Research and qualify

**Purpose:** Decide which leads are worth an application.

**Inputs:** Rows marked `New` or `Researching`, criteria from step 1, `resume.md`, the live
posting at each row's Link

**Outputs:** Each such row set to `Ready` or `Skip`, with findings in Notes; an updated
`resume_suggestions.md`.

**Actions:** For each row:
1. Open the Link. If the posting is closed or gone, set `Skip` with `Skip <date>: posting
   closed`.
2. Check company stage against the Hard Constraints. Public companies and established firms
   pass. For a startup, confirm the funding stage from a named source.
3. Confirm the company fits Industries & Companies.
4. Confirm comp against the floor: use the posting's range if listed, otherwise Levels.fyi,
   LinkedIn Salary, or Glassdoor. Record the figure and its source. Mark estimates as
   estimates.
5. Write the one or two strongest concrete matches between the role and Christopher's real
   experience on `resume.md`.
6. If any check fails, set `Skip` with the reason. If all pass, set `Ready` and append
   `Verified <date>`.
7. After all rows are done, run `bun run resume-review`. It compares `resume.md` with the open
   leads and writes suggested changes to `resume_suggestions.md`. Never edit `resume.md` from
   those suggestions without Christopher's say-so, and never add experience he has not
   confirmed.

## Step 9: Draft cover letters

**Purpose:** Have a reviewable draft ready for every qualified lead.

**Inputs:** Rows marked `Ready`, `resume.md`, `cover_letter_prompt.md`, the job description

**Outputs:** One file per lead at `cover_letters/[company-slug]-[role-slug].md`; the filename
noted in the row.

**Actions:**
1. Run `bun run draft-cover-letters --dry-run` to see which leads would get a letter.
2. Run `bun run draft-cover-letters` to draft them. For a single lead, fill
   `cover_letter_prompt.md` by hand instead.
3. Check each letter: 3 to 4 paragraphs, under 350 words, metrics taken only from
   `resume.md`, no "I am excited to apply", no em dashes.
4. Append `Cover letter: <filename>` to the row's Notes.
5. Leave the status as `Ready`. Drafting is not applying.

## Step 10: Log submissions

**Purpose:** Record what Christopher actually applied to.

**Inputs:** Christopher's answer, rows marked `Ready`

**Outputs:** Confirmed rows set to `Applied` with a submission date.

**Actions:**
1. Ask: "Which leads did you submit applications for this week?" List the `Ready` rows by
   company and role so he can answer quickly.
2. Wait for the answer.
3. For each one he confirms, set `OutreachStatus = Applied` and append `Applied <date>`.
4. If none, record that for the summary. Never mark a row `Applied` on your own.

## Step 11: Draft follow-ups

**Purpose:** Nudge applications that have gone quiet.

**Inputs:** Rows marked `Applied` whose `Applied` date is 7 to 14 days ago with no response
recorded

**Outputs:** One follow-up draft per such row, shown to Christopher.

**Actions:**
1. For each row, draft a 3-sentence follow-up email that references one specific detail from
   the row's Notes. Direct tone, no em dashes.
2. Show every draft to Christopher and wait for his decision on each.
3. Save approved drafts to `outreach/[company-slug]-[role-slug]-followup-<date>.md` and append
   `Follow-up drafted <date>` to Notes.
4. Never send a follow-up. Christopher sends it himself.

## Step 12: Print the weekly summary

**Purpose:** One screen that says what happened and what needs Christopher.

**Inputs:** Counts and notes gathered in steps 2 to 11

**Outputs:** The summary below, printed in chat. Nothing is written to disk.

**Actions:** Print:
- New leads added: N
- New leads skipped at filtering: N
- Leads researched: N (passed: N, skipped: N)
- Cover letters drafted: N
- Applications submitted: N
- Follow-ups drafted: N
- Resume suggestions: the items from `resume_suggestions.md`, most important first
- Active Priorities: list by company and role
- Profile and resume conflict from step 2, and how it was resolved
- Anything blocked or waiting on Christopher, one line each
