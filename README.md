# Manick Job Portal — Indian Job Recruitment Platform

Manick Job Portal is a full-stack job portal for India with three independent portals:

- **Job seekers** — search & filter live jobs, save jobs, one-click applications with screening answers, resume management (PDF/DOCX with content verification), application history, job alerts, notifications and messaging, data export and account deletion.
- **Recruiters / employers** — verified company profiles, job lifecycle (draft → review → live → paused → closed, duplicate, delete), a drag-and-drop **Kanban ATS** with private notes and ratings, interview scheduling with notifications, candidate search (privacy-aware), team seats and CSV export.
- **Admins** — analytics (registrations, plans, pipeline), user management (suspend / activate / verify / role / delete), job moderation (approve / reject / suspend / feature), company verification, reports, content (career advice, categories), platform settings, maintenance mode, audit log and email outbox.

Stack: Next.js 16 (App Router, Server Actions, React 19), TypeScript, Tailwind CSS v4, Drizzle ORM, PostgreSQL, Zod, Lucide icons.

---

## Quick start (local)

```bash
# 1. Configure environment
cp .env.example .env            # set DATABASE_URL (PostgreSQL)

# 2. Install & create schema
npm install
npx drizzle-kit push            # applies src/db/schema.ts directly (no migration files needed in dev)

# 3. Seed demo data (companies, jobs, plans, demo accounts)
npx tsx --env-file=.env src/db/seed.ts

# 4. Run
npm run dev                     # http://localhost:3000
```

### Demo accounts (password for all: `Demo@12345`)

| Role      | Email                        | Lands on                |
|-----------|------------------------------|-------------------------|
| Admin     | admin@manickjobportal.in            | /admin                  |
| Candidate | candidate@manickjobportal.in        | /candidate/dashboard    |
| Recruiter | recruiter@manickjobportal.in        | /recruiter              |

**Email verification in development:** no SMTP provider is configured by default, so every email is written to the *email outbox* (Admin → System). Newly registered users also see the verification link directly on the "Verify your email" page when `NODE_ENV !== production`.

### Useful scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build && npm start` | Production build & server |
| `npm run typecheck` | TypeScript check |
| `npx tsx --test src/lib/match.test.ts` | Unit tests (matching, completeness, formatting) |
| `npx tsx --env-file=.env src/db/seed.ts` | Re-seed (idempotent for demo accounts & jobs) |
| `npx playwright install chromium && npx playwright test` | End-to-end suite against a running app (`E2E_BASE_URL`, default `http://localhost:3000`) |

---

## Architecture

```
src/
  app/
    (public)/            Public site: home, jobs search & details, companies, career advice,
                         salary insights, pricing, login/register, reset password, verify email
    candidate/           Job-seeker portal (dashboard, profile, resumes, applications, saved & alerts)
    recruiter/           Employer portal (dashboard, jobs, pipeline ATS, application review,
                         candidate search, company & team)
    admin/               Admin portal (overview, users, jobs, companies, reports, content, system)
    inbox/ settings/     Shared authenticated pages
    actions/             Server Actions (auth, candidate, recruiter, admin, shared) — all authorised server-side
    api/                 Route handlers: resume download (authorised), recruiter CSV export,
                         account data export (DPDP), health check
    sitemap.ts robots.ts SEO
  components/            UI primitives, forms (ActionForm/Field), site chrome, dashboard shell,
                         Kanban board, job form, confirm dialogs
  db/                    schema.ts (Drizzle, PostgreSQL), index.ts (pool + client), seed.ts
  lib/
    auth.ts              Sessions (hashed tokens in httpOnly cookies), requireUser() role guards
    password.ts          scrypt password hashing, token generation
    services.ts          Email outbox, in-app notifications, audit log, rate limiting, secure upload storage
    validation.ts        Zod schemas for every form
    match.ts             Transparent skill/experience match score + profile completeness
    taxonomy.ts          Skill normalisation and upserts
    queries/             Data access (jobs search, homepage, dashboards, admin analytics)
```

### Security controls

- Passwords hashed with **scrypt** (per-password salt, timing-safe comparison).
- Session tokens are random 256-bit values; only their **SHA-256 hash** is stored. Cookies are `httpOnly`, `sameSite=lax`, `secure` in production.
- **Authorization on every mutation** via `requireUser(role)` and ownership checks (e.g. recruiters may only touch jobs/applications of their own company; resumes are downloadable only by the owner, admins, or a recruiter whose company received that resume).
- Login rate limiting (8 attempts / 15 min per email); registration and reset throttling; password-reset responses do not reveal whether an account exists.
- Resume uploads: type allow-list **and** magic-byte verification, 5 MB cap, randomised storage keys, path-traversal guard.
- CSV export neutralises spreadsheet formula injection.
- Output escaping by React; JSON-LD is HTML-escaped; `rel="noopener noreferrer"` on external links.
- Suspended accounts lose all sessions immediately; deleted accounts cascade-delete personal data.
- Audit trail for admin and recruiter actions (`audit_logs`).

### Matching & AI-readiness

`src/lib/match.ts` computes an explainable score: **75% skill overlap** (required skills weight 1, preferred 0.5) plus **25% experience fit**. It never uses protected characteristics and never rejects candidates automatically — recruiters always make the decision. The function is covered by unit tests and is the seam where an LLM-based resume analyser or JD generator can be plugged in later.

---

## Data model (high level)

`users` · `sessions` · `candidate_profiles` · `candidate_skills` · `resumes` · `saved_jobs` · `job_alerts` · `companies` · `company_members` (unique per company+user) · `followed_companies` · `jobs` · `job_skills` · `job_categories` · `skills` · `applications` (unique per job+candidate — prevents duplicate applications) · `application_events` (status history) · `candidate_notes` · `interviews` · `notifications` · `messages` · `reports` · `blog_posts` · `newsletter_subscribers` · `subscription_plans` · `audit_logs` · `email_log` · `platform_settings`.

All foreign keys declare cascade / set-null rules, and hot paths are indexed (job status, publish date, company, city, application status, notification read state).

---

## Production deployment

1. **Database:** managed PostgreSQL 15+ with daily snapshots and point-in-time recovery. Apply schema with `npx drizzle-kit push` (or generate versioned migrations with `npx drizzle-kit generate` for regulated environments).
2. **Environment:** set `DATABASE_URL`, `NEXT_PUBLIC_APP_URL` (https), `UPLOAD_DIR` (persistent volume) or migrate the storage adapter to S3/R2, plus any integrations listed in `.env.example`.
3. **Build:** `npm ci && npm run build && npm start` behind a TLS-terminating reverse proxy (nginx, Caddy or a managed platform). Serve `/api/health` to your uptime monitor.
4. **Email:** wire the `sendEmail()` adapter in `src/lib/services.ts` to SMTP/SES/Resend. Until then, emails are stored in the outbox.
5. **Backups:** snapshot the database and the uploads volume; test restores quarterly.
6. **Logging & monitoring:** forward stdout to your log platform; `audit_logs` and `email_log` are queryable for support investigations.
7. **Scaling:** rate limiting is in-memory — move `rateLimit()` to Redis when running more than one instance.

---

## Known limitations & pending external integrations

| Area | Status | Requires |
|------|--------|----------|
| Google OAuth sign-in | Pending | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and an OAuth callback route |
| Email delivery (SMTP/SES/Resend) | Outbox implemented; external delivery pending | Provider credentials |
| S3-compatible resume/logo storage | Local disk adapter implemented; S3 adapter pending | Bucket & keys |
| Razorpay checkout, webhooks, invoices, renewals | Plans & pricing UI implemented; payment flow pending — plans are **not** activated from the browser | Razorpay keys & webhook secret |
| Resume parsing, AI analyser, JD generator, interview-question generator | Matching engine implemented; LLM features pending | LLM API key |
| Resume builder (templates → PDF) | Pending | — |
| Candidate profile views analytics | Pending (no view tracking yet) | — |
| Notification preferences (per channel) | Pending (notifications and emails are always sent) | — |
| Work experience & certifications as structured entities | Stored as text in profile (structured entities pending) | — |
| Recent searches / search suggestions from history | Pending (popular searches and skill/category suggestions are live) | — |
| Redis caching & background jobs | Pending (in-memory rate limiting only) | Redis |
| Elasticsearch / OpenSearch | Upgrade path — PostgreSQL full-text search is active | Search cluster |
| Blocked companies, company images gallery | Pending | — |
| Dark mode | Available (toggle in header; respects OS preference) | — |
| Testimonials on homepage | Illustrative copy — replace with CMS content before launch | — |
| Automated E2E (Playwright) suite | Implemented: 23 tests (candidate, recruiter and admin journeys, public site, authorization, mobile layout) — all passing on the seeded build | Chromium + system deps (`npx playwright install chromium`) |

Demo data (companies, jobs, candidate) is seeded for local evaluation only; delete it before going live with `DELETE FROM users WHERE email LIKE '%@manickjobportal.in'`.
