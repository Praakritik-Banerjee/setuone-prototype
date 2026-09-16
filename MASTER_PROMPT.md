# MASTER PROMPT — paste this whole file into your AI coding assistant in VS Code
(Copilot Chat / Cursor / Claude Code / Continue — anything that can read and edit
a repo). It is written so the assistant can pick up work in this repo, extend it,
or rebuild pieces of it, without losing the plot.

---

## 1. Role and context

You are acting as a full-stack engineer building a working prototype for a
government hackathon problem statement. A working codebase already exists in
this repository (backend + frontend). Your job is to **understand it, then
extend/harden it** according to the requirements below — do not throw it away
and start over unless a task explicitly says to replace a module.

**Problem statement (verbatim, for reference):**

> Title: System integration and interoperability among government digital
> platforms, resulting in fragmented service delivery
>
> Government departments operate multiple portals, mobile applications,
> registries, workflow systems and databases that have often been developed
> independently. Differences in data formats, identifiers, authentication
> methods, APIs, process definitions and ownership structures can prevent
> seamless information exchange. Citizens and businesses may be required to
> submit the same information repeatedly, track applications across
> different portals, or visit multiple offices. Officials may lack a
> consolidated view of beneficiaries, applications, approvals, grievances
> and service outcomes. The challenge is to enable secure, standards-based
> interoperability without requiring complete replacement of existing
> systems.
>
> Expected outcome: An interoperability framework, middleware layer or
> federated service delivery architecture that supports API-based exchange,
> common data standards, master-data management, consent-based data
> sharing, single sign-on or federated identity, event-driven
> notifications, unified application tracking and configurable workflow
> orchestration. The solution should provide reusable connectors for
> legacy and modern systems, audit logs, role-based access, data-quality
> checks, exception handling and monitoring dashboards. Expected outcomes:
> fewer duplicate submissions, reduced processing time, consistent
> records, improved citizen experience, better cross-department
> coordination, measurable improvement in service-level compliance.
>
> Organization: Government of Maharashtra — Maharashtra State Innovation
> Society, Department of Skills, Employment, Entrepreneurship and
> Innovation. Category: Software.

## 2. What already exists in this repo (read before writing anything)

```
backend/
  server.js              — Express app, mounts all routes (the "API Gateway")
  db.js                  — JSON-file data layer: load()/save() — swap for a
                            real DB later without touching route logic
  seed.js                — creates demo departments/services/users
  connectors.js           — mock connectors (Aadhaar e-KYC, PAN, ration DB,
                            income registry) behind one verify()/fetch() shape
  audit.js               — logAction() helper used by every route
  middleware/auth.js      — JWT sign/verify + requireAuth + requireRole (SSO + RBAC)
  routes/
    auth.js               — login (SSO) + citizen self-registration (MDM dedupe)
    citizens.js            — "golden record" master view of a citizen
    consent.js             — grant/list/revoke consent records
    applications.js         — submit / list / advance-stage / reject
                              (this is the workflow orchestration + unified
                              tracking + event-driven notifications engine)
    connectorRoutes.js      — verify endpoints + connector health/log
    audit.js                — GET audit trail (admin only)
    dashboard.js            — aggregated stats + SLA compliance %
frontend/
  index.html / register.html   — SSO login / citizen sign-up
  citizen.html                 — apply, unified tracker, consent manager
  officer.html                 — department queue, advance/reject workflow
  admin.html                   — cross-department stats, connector health, audit log
  css/style.css                — shared design system ("civic ledger" theme:
                                  parchment paper, ink navy, marigold + teal accents)
  js/api.js                    — fetch wrapper + session helpers shared by all pages
README.md               — architecture explanation, setup steps, demo script
```

Run it first to see current behaviour:
```bash
cd backend && npm install && node seed.js && npm start
# open http://localhost:4000, demo logins are in README.md
```

## 3. Design principles to preserve while extending

1. **Gateway pattern, not a rewrite.** Every department's system is
   represented as a connector with a narrow interface (`verify(...)`,
   `fetch(...)`, `lookup(...)`). New department integrations = new connector
   file, not changes scattered across routes.
2. **One identity, one token.** `middleware/auth.js` issues a single JWT
   that every route trusts. Do not add per-department auth — that recreates
   the fragmentation this project exists to fix.
3. **Workflows are data, not code.** A service's approval flow is the
   `workflow: string[]` array on that service record. Adding a new
   department service with a different number of stages must require zero
   code changes — only a new row via `seed.js` or an (future) admin UI.
4. **Everything mutating state gets audited.** Any new route that changes
   data must call `logAction()` from `audit.js`.
5. **RBAC is enforced server-side**, never assume the frontend hides
   something well enough — every route must call `requireAuth` and, where
   relevant, `requireRole(...)`.
6. **The JSON file DB is a placeholder.** Keep all data access going through
   `db.js`'s `load()/save()` so swapping in Postgres later is a one-file
   change. Don't reach into `data/db.json` directly from a new route.
7. **Design language**: parchment/paper background, ink-navy text, a serif
   display face for headings + a sans body face, marigold for primary
   action, teal for success/completed, red for rejected/breached. Don't
   default to generic SaaS card/gradient styling — match `css/style.css`'s
   existing tokens (`:root` variables).

## 4. Priority backlog — work through these in order

### P0 — correctness & robustness of what exists
- [x] Add input validation (e.g. `zod` or manual checks) to every POST/PATCH
      body in `routes/*.js`; return 400 with a clear message on bad input.
- [x] Add concurrency-safety to `db.js` (simple file lock or in-memory mutex)
      so two simultaneous writes can't clobber each other.
- [x] Add a data-quality check step before an application is accepted:
      cross-field checks (e.g. mobile number format, required fields per
      service) — surface failures as structured errors, not generic 500s.
- [ ] Write integration tests (e.g. with `supertest` + `jest`) for: login,
      duplicate citizen registration, application submit → advance →
      complete, consent grant/revoke, RBAC rejection cases (officer from
      wrong department, citizen viewing someone else's record).

### P1 — features called out in the problem statement not yet built
- [x] **Grievance module**: citizens can raise a grievance against any
      application (new `grievances` collection + routes), officers can
      respond, admin sees grievance SLAs alongside application SLAs.
- [ ] **Data-quality dashboard**: surface duplicate-citizen near-matches
      (fuzzy match on name+mobile/aadhaar) for admin review, not just hard
      dedupe at registration.
  - [ ] **Configurable workflow builder UI** (admin): create a new service +
      its ordered stage list from the Admin dashboard instead of editing
      `seed.js`.
- [ ] **Real notification delivery option**: integrate a sandbox
      email/SMS provider (e.g. Nodemailer with Ethereal for email) behind a
      `notifications.js` module so `notify()` can actually deliver, with a
      console/mock fallback if no provider is configured.
- [ ] **Exception/escalation handling**: if `slaBreached` is true for more
      than N hours, auto-flag the application as "Escalated" and notify the
      admin — add a small scheduled job (`setInterval` is fine for the
      prototype) that scans applications.

### P2 — production-readiness
- [ ] Swap `db.js` for a real database (Postgres + Prisma or Sequelize is a
      reasonable choice) while keeping the exported function names the
      same so routes don't change.
- [ ] Add OpenAPI/Swagger spec for the API (helps other departments'
      teams integrate against this gateway).
- [ ] Containerize (`Dockerfile` + `docker-compose.yml` with the app + a
      Postgres service).
- [ ] Add rate limiting and helmet-style security headers to `server.js`.
- [ ] Replace the mock connectors with real integration stubs and clearly
      mark which ones need real credentials (Aadhaar e-KYC via a UIDAI
      AUA/KUA licence, DigiLocker, a state SSO such as MahaOnline, etc.),
      documenting exactly what a real deployment would need to swap in.

## 5. How to work

- Before adding a new route, check whether an existing connector, service,
  or table already covers the need — extend rather than duplicate.
- After each backlog item, run the app and manually exercise the flow (or
  the test suite once it exists) before moving to the next item.
- Keep `README.md` and this file in sync: when you complete a P0/P1/P2 item,
  check it off and add one line to `README.md`'s feature table if it
  introduces a new capability.
- Ask a clarifying question only if a requirement is genuinely ambiguous
  (e.g. which real SMS/email provider to wire up) — otherwise make a
  reasonable choice and note the assumption in a code comment.

Start by running the existing prototype, confirming the demo script in
`README.md` works end-to-end, and then proceed through the backlog above.
