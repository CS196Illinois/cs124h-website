# Website verification

Run from the repository root after `npm ci` and `npx playwright install chromium`.

- `npm test`: API integration tests, permission checks, grading calculations, input validation, and CSV encoding.
- `npm run test:e2e`: Chromium browser workflows, including desktop/mobile gradebooks, keyboard interaction, downloads, failure recovery, public pages, role access, attendance, sprints, and sandbox behavior.
- `npm run build`: optimized Next.js production build.

The API and browser suites require `.env.test.local` with Supabase credentials and `USE_TEST_TABLES=true`. Browser tests force both test-table flags and build and start their own production-mode server on port 3100. Do not run the two suites concurrently: they share and reset the same `test_` tables. Production tables must never be used for test fixtures. The tests intentionally replace CILogon sign-in with signed test sessions and disable live Google Sheets side effects. Apply `scripts/migrate-event-audiences.sql` in Supabase before using scoped event audiences in production; existing events remain public until then.

Gradebook UX tests save desktop and 320px mobile screenshots under `test-results/`. The suite also checks 390px layouts. Use `PLAYWRIGHT_BROWSERS_PATH` when installing and running browsers in a custom location.

Grading behavior checked by the suite:

- Students only receive their own action items. PM queries are limited to their group plus their own items; head PM queries cover PM/student recipients plus their own items.
- Course leads and the web team retain their existing broader API access. A web developer's own gradebook is a PM-style view of their assigned group. Lead web developers can use the course-lead gradebook through role navigation.
- Only the assigner can grade. Reopening or disabling grading clears the score and feedback. Invalid scores and incompatible simultaneous edits are rejected.
- Averages give assignments equal weight within a student's results, and students equal weight within the group/course. Ungraded work is excluded; zero is a valid grade.
- Exports preserve assignment identity, zero scores, feedback, commas, quotes, and line breaks, and neutralize spreadsheet formulas in text fields.

Passing these checks does not establish zero defects. Real CILogon login, live Google Sheets synchronization, production configuration/data, other browser engines, and large-scale concurrent traffic need separate verification.

Login regression checks cover same-identity concurrent roster claims, alternate Illinois identity claims, session-cookie consistency, stale-cookie reset, and explicit single-attempt sign-in. Sprint tests cover PM append-only question changes and prohibit deleting a sprint or changing its scoring. The public support API has mocked storage/SMTP tests for validation, access control, email formatting, and failure recovery; browser tests cover the signed-out form and student grade view. See `SUPPORT_SETUP.md` for the required support-table migration, mailbox setup, and live email verification.

The onboarding tour is skipped in browser automation with `NEXT_PUBLIC_E2E=true`; real users see it once per net ID and role, with a local completion marker and a skip option.

Event lists show created or joined events; only lead web developers receive the full list. Attendance shows eligible open events and joined history. PM and web developer event creation defaults to their assigned group, with explicit audience selection required when no group is assigned. Browser tests cover audience selection and editing. Sprint completion reads and writes are restricted to the assigned group for both PMs and web developers; an unassigned manager gets an empty roster. Developer PM screens request `group_scope=true` for action items while developer previews retain their existing tools.

The dependency lockfile includes compatible security updates. Next.js's PostCSS dependency is overridden within the PostCSS 8 release line to avoid its older vulnerable pin; verify this override whenever upgrading Next.js. Run `npm audit` along with the build after dependency updates.
