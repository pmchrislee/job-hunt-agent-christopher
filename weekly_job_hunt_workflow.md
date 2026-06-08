# Weekly Job Hunt Workflow

Run this every Monday. Steps are sequential. Do not skip steps.

---

## Step 1 — Scrape New Leads

**Purpose:** Surface fresh job postings that match the profile.
**Input:** `job_search_profile.md`
**Output:** New rows appended to `job_leads.md`

Actions:
1. Read `job_search_profile.md` to load role titles, locations, industries, comp floor, and constraints.
2. Run `bun run scrape_jobs.ts` to query for new listings.
3. For each result, check it against constraints (Series B+, $200k+, SF Bay Area or NYC, no sponsorship). Drop any that fail.
4. Append passing leads to `job_leads.md` with status `New` and today's date. Do not duplicate rows already in the file.

---

## Step 2 — Triage Existing Leads

**Purpose:** Keep the pipeline clean and prioritized.
**Input:** `job_leads.md`
**Output:** Updated statuses; stale leads archived

Actions:
1. Read every row in `job_leads.md`.
2. For any lead with status `New` and no activity in 3+ days, change status to `Researching`.
3. For any lead with status `Applied` and no response in 14+ days, change status to `Stale`.
4. For any lead with status `Stale` for 7+ more days, move the row to a `## Archive` section at the bottom of the file and remove it from the main table.
5. Flag any lead with status `Interview` or `Offer` at the top of the file under `## Active Priorities`.

---

## Step 3 — Research Top Leads

**Purpose:** Gather enough signal to decide whether to apply and what to emphasize.
**Input:** Each lead with status `New` or `Researching` in `job_leads.md`
**Output:** Notes column updated for each researched lead

For each lead, do the following and write findings in the Notes column:
1. Look up the company — funding stage, headcount, recent news, product focus.
2. Confirm the comp range is publicly listed or estimable (Levels.fyi, LinkedIn Salary, Glassdoor). If below $200k, set status to `Skip` with a note.
3. Identify 1–2 specific things from the job description that match Christopher's background (AI/ML, enterprise products, cross-functional leadership, fintech/health/edtech).
4. Flag any red flags: no comp listed, no remote option despite profile, requires visa sponsorship.

---

## Step 4 — Generate Cover Letters for Apply-Ready Leads

**Purpose:** Produce a tailored cover letter for each lead ready to apply to.
**Input:** `resume.md`, `cover_letter_prompt.md`, and each lead with status `Researching` that passed Step 3
**Output:** One `.md` file per lead saved to `cover_letters/[company]-[role].md`; lead status updated to `Ready`

Actions:
1. For each qualifying lead, open `cover_letter_prompt.md` and fill in Company, Role Title, and Job Description.
2. Generate the cover letter following the template guidelines (3–4 paragraphs, under 350 words, concrete metrics, no "I am excited to apply").
3. Save to `cover_letters/[company-slug]-[role-slug].md`.
4. Update the lead's status in `job_leads.md` to `Ready` and note the cover letter filename.

---

## Step 5 — Log Applications Submitted This Week

**Purpose:** Record what was actually sent so nothing gets lost.
**Input:** Any leads Christopher confirms were submitted
**Output:** Status updated to `Applied` with submission date in Notes

Actions:
1. Ask: "Which leads did you submit applications for this week?"
2. For each confirmed submission, update status from `Ready` to `Applied` and add the submission date to Notes.
3. If none, note "No applications submitted this week" in the weekly summary.

---

## Step 6 — Follow Up on Applied Leads

**Purpose:** Surface leads that need a nudge.
**Input:** `job_leads.md` — all rows with status `Applied`
**Output:** Follow-up message drafted for any lead 7–14 days old with no response

Actions:
1. Find all rows with status `Applied` where the date in Notes is 7–14 days ago.
2. For each, draft a 3-sentence follow-up email: reference the role, express continued interest, ask about next steps. Do not be generic — reference one specific thing about the company from the Notes column.
3. Present the draft to Christopher for review. Do not send anything automatically.

---

## Step 7 — Weekly Summary

**Purpose:** Close the loop so next week starts clean.
**Input:** Final state of `job_leads.md`
**Output:** Short summary printed to the terminal

Print:
- New leads added this week: N
- Leads researched: N
- Cover letters generated: N
- Applications submitted: N
- Follow-ups drafted: N
- Leads in `Active Priorities`: list them by name
- One-line note on anything blocked or needing Christopher's input
