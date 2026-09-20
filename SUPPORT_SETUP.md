# Support tickets and email setup

The public form is at `/support`, linked from the navbar, sign-in screen, and access-error page. Students provide their full name, NetID, category, subject, description, and optionally up to three PNG/JPEG/WebP screenshots (3 MB total). Reports are self-reported, not authenticated identities.

## Database

Run `scripts/migrate-support-tickets.sql` in the project's Supabase SQL editor before deploying. It creates both production and `test_` tables, private screenshot storage within each ticket, and an atomic hourly rate-limit function. This is additive and repeatable. RLS is enabled and access is restricted to the server service role; no public read endpoint exposes tickets or screenshots.

The lead web developer inbox is `/user/lead_web_dev/support`. It supports viewing reports and screenshots, replying by email, resolving/reopening tickets, pagination, and retrying notification delivery.

## CS 124 Honors mailbox

Set these **server-only** environment variables in the deployment environment (and `.env.local` for local use):

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=<full CS 124 Honors mailbox address>
SMTP_PASSWORD=<mailbox app password>
```

For Gmail, enable 2-Step Verification and create an app password in the mailbox's Google account. Enter the app password as the SMTP password; do not use the normal account password or commit the secret. Some managed Workspace accounts do not permit app passwords; check the account policy if the option is absent. See [Google's app-password instructions](https://support.google.com/accounts/answer/185833) and [SMTP settings](https://support.google.com/a/answer/176600). Other SMTP services are supported by changing host, port, and credentials; port 587 uses required STARTTLS.

The authenticated mailbox is the sender. Recipients are looked up on every delivery from `users` rows whose role is `LEAD_WEB`, using their `net_id@illinois.edu` address, consistent with other roster contacts. Assign the role before testing delivery. All current lead web developers receive the report; `Reply-To` points to the student's Illinois address.

Reports and screenshots are saved before mail is attempted. Missing credentials, missing role assignments, or SMTP failures leave notification pending, with the report still visible in the inbox. After correcting configuration, use **Retry email notification**. There is no scheduled background retry. SMTP acknowledgement followed by a database/network failure can cause a duplicate on retry; emails retain the same reference and Message-ID. A crashed attempt can be retried after two minutes.

The form uses a stable submission ID to avoid duplicate reports when a response is lost. Database counters limit submissions to 5 per NetID per hour and 100 site-wide per hour; Vercel deployments also enforce 20 per platform-reported IP per hour. These are abuse controls, not verification of a NetID. Ticket content and screenshot data are retained until an administrator removes them; resolving a ticket does not delete it.

## Verification and rollout

- Apply the migration, set SMTP credentials, and deploy the code.
- Submit one real report while signed out, with a screenshot. Confirm it appears in the lead developer inbox and reaches the assigned lead's mailbox; confirm replying addresses the student.
- Test Illinois sign-in in a fresh browser session and in a previously affected session. OAuth itself cannot be validated with the automated suite, which uses signed test sessions.
- Set `NEXTAUTH_URL` to the exact canonical HTTPS site origin, register its `/api/auth/callback/cilogon` URI in CILogon, and keep `NEXTAUTH_SECRET` stable across deployments. Redirect alternate domains to that origin before starting authentication.

The automated tests never send live mail when `USE_TEST_TABLES=true`. SMTP unit tests replace the transport and database with mocks. Browser support tests intercept submission responses to check the public UI independently of deployment setup.

The `support-mailer` dependency is an npm alias for patched Nodemailer 10. This avoids NextAuth v4's optional Nodemailer 7 peer constraint; the site uses CILogon, not NextAuth's email provider.

The grade view borrows the current-average, assignment-score, and feedback hierarchy from [Canvas's student Grades view](https://community.instructure.com/en/kb/articles/661305-how-do-i-view-my-grades-in-a-current-course). It keeps this site's equal-assignment weighting and labels the result as an action-item average, not a final course grade.
