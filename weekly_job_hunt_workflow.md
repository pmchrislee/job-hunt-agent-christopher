# Weekly Job Hunt Workflow

Run every Monday, in order. Don't skip steps. Read criteria fresh from `job_search_profile.md`
each run — don't carry over assumptions from a prior week.

1. Read `job_search_profile.md`. Extract Target Roles, Work Arrangement, Target Locations,
   Industries & Companies, Compensation floor, Search Urgency, Hard Constraints.

2. Read `resume.md`. If the actual experience on it doesn't support Target Roles (e.g. no
   engineering titles against a Software Engineer target), stop and tell Christopher before
   continuing. Don't silently proceed on a mismatch.

3. Run `bun run scrape_jobs.ts`.

4. For each result returned, drop it if any of these are true:
   - Fails a Hard Constraint (visa sponsorship required, below Series B, not full-time W-2).
   - Location doesn't match Target Locations (SF Bay Area, or Remote — anywhere in US).
   - Not credibly one of the target Industries & Companies (tech consulting, Big Tech, Series
     B+ startups, enterprise SaaS/B2B) — obvious mismatches only (e.g. retail, hospitality); if
     unsure, keep it for step 8 to judge.
   - Comp is listed and fails the Compensation floor — if Search Urgency is Passive, it must
     clearly beat the floor by a real margin; if Actively searching (current), meeting the
     floor is enough. If comp isn't listed, don't drop it here.
   - Same Company + Role + Link already exists in `job_leads.md`.
   Do not filter on Work Arrangement — it's Flexible, so every arrangement is acceptable.

5. Append every surviving result to `job_leads.md`: `OutreachStatus = New`, Notes = one-line
   match reason + `Found <today's date>`.

6. Scan every existing row in `job_leads.md`. If a row has no date in Notes, add one (best
   estimate of when it was added).

7. Update statuses using the dates in Notes:
   - `New` with no activity in 5+ days → `Researching`.
   - `Applied` with no response in 21+ days → `Stale`.
   - `Stale` for 10+ more days → cut the row, paste it into a `## Archive` section at the bottom
     of the file (create the section if missing).
   - `Interview` or `Offer` → copy the row into an `## Active Priorities` section at the top of
     the file (create it if missing).

8. For each `New` or `Researching` lead, research it and write findings straight into Notes:
   - If it's a startup, confirm funding stage is Series B+ (Big Tech, enterprise SaaS
     incumbents, and consulting firms pass this automatically). If a startup and below Series
     B, set `OutreachStatus = Skip`.
   - Confirm it's credibly one of the target Industries & Companies. If not, `Skip`.
   - Confirm comp (Levels.fyi / LinkedIn Salary / Glassdoor) meets the Compensation floor — same
     Passive-vs-Active rule as step 4. If it fails, `Skip`.
   - Write the 1–2 strongest concrete matches between the role and Christopher's actual resume
     experience (not the target title, the real history).
   - If it passes all checks, set `OutreachStatus = Ready`.

9. For each `Ready` lead: fill `cover_letter_prompt.md` with Company, Role Title, Job
   Description. Generate the letter (3–4 paragraphs, under 350 words, concrete metrics from
   `resume.md`, no "I am excited to apply"). Save to
   `cover_letters/[company-slug]-[role-slug].md`. Add the filename to Notes. Leave
   `OutreachStatus = Ready` — don't mark it `Applied` yet.

10. Ask Christopher: "Which leads did you submit applications for this week?" For each one he
    confirms, set `OutreachStatus = Applied` and append the submission date to Notes. If none,
    note that for the summary.

11. For every `Applied` row that is 7–14 days old with no recorded response: draft a
    3-sentence follow-up email referencing one specific detail from that lead's Notes. Show it
    to Christopher for approval. Never send it yourself, and never route it through a channel
    visible to his current employer — he's employed and this search is discreet regardless of
    Search Urgency.

12. Print the weekly summary:
    - New leads added: N
    - Leads that passed qualification vs. were skipped: N / N
    - Leads researched: N
    - Cover letters generated: N
    - Applications submitted: N
    - Follow-ups drafted: N
    - `## Active Priorities`: list by name
    - Profile/resume conflict from step 2, if any
    - One line on anything blocked or needing Christopher's input
