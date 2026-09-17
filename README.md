# SetuOne — Unified Government Service Delivery Gateway (Prototype)

Prototype for the problem statement **"System integration and interoperability
among government digital platforms, resulting in fragmented service
delivery"** (Government of Maharashtra — Maharashtra State Innovation
Society, Dept. of Skills, Employment, Entrepreneurship & Innovation).

It demonstrates an **interoperability middleware layer** that fronts
independent department systems with one gateway: shared identity (SSO),
master citizen records, consent-based data sharing, reusable connectors to
legacy/modern registries, configurable workflow orchestration, event-driven
notifications, unified application tracking, audit logging, RBAC, and a
monitoring dashboard.

## Why this architecture

Instead of replacing each department's system, the gateway sits in front of
them (an **API Gateway / Enterprise Service Bus pattern**) and talks to each
one through a small, swappable **connector** (`backend/connectors.js`). In
this prototype the connectors are mocked (Aadhaar e-KYC, PAN verification,
legacy Ration Card DB, State Income Registry) so the whole flow runs with no
external dependencies — in a real deployment each mock is replaced by a
client for the real department API/SOAP service/file feed, and nothing else
in the codebase has to change.

```
                     ┌───────────────────────────┐
   Citizen ─────────▶│                           │
   Portal            │      SetuOne Gateway      │───▶ Aadhaar e-KYC (mock)
                      │  (Express API, this repo) │───▶ PAN Verification (mock)
   Officer ──────────▶│                           │───▶ Ration Card DB (mock)
   Console            │  SSO · RBAC · Consent ·   │───▶ Income Registry (mock)
                      │  Master Data · Workflow · │
   Admin ────────────▶│  Audit · Notifications    │
   Dashboard          └───────────────────────────┘
```

## Tech stack

- **Backend**: Node.js + Express (API gateway, routes per capability)
- **Storage**: a JSON-file data layer (`backend/db.js`) so the prototype runs
  with zero setup — swap it for Postgres/Mongo in production without
  touching route logic (every route only calls `load()`/`save()`)
- **Auth**: JWT-based single sign-on, shared across every route (`middleware/auth.js`)
- **Frontend**: plain HTML/CSS/JS (three portals: citizen, officer, admin) —
  no build step, served statically by Express

Optional email delivery uses Nodemailer. Set `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and optionally `SMTP_FROM` plus
`NOTIFICATION_TEST_RECIPIENT`. Without `SMTP_HOST`, notifications remain in
the JSON store and the server logs that it is running in mock mode. Ethereal
credentials can be created at https://ethereal.email and used with its SMTP
host, port, username, and password; view test messages in its web inbox.

## Features implemented

| Problem statement ask | Where it lives |
|---|---|
| API-based exchange | `backend/routes/*.js` — one REST API per capability |
| Common data standards / Master data management | `routes/citizens.js` "golden record", exact and near-duplicate review in `mdm.js` and `routes/admin.js` |
| Consent-based data sharing | `routes/consent.js` |
| Single sign-on / federated identity | `middleware/auth.js`, one JWT used across citizen/officer/admin portals |
| Event-driven notifications | `notify()` in `routes/applications.js`, fired on submit/advance/reject |
| Unified application tracking | `GET /api/applications` + citizen "golden record" |
| Configurable workflow orchestration | Each `service.workflow` is a plain array of stage names — add a service with a new workflow with no code change |
| Reusable connectors for legacy/modern systems | `backend/connectors.js` |
| Real free verification | India Post pincode district/state lookup; local PAN holder-type structure validation (not live PAN status) |
| Audit logs | `backend/audit.js`, `routes/audit.js`, visible in Admin dashboard |
| Role-based access control | `requireRole()` in `middleware/auth.js` |
| Exception handling | rejection flow plus scheduled SLA escalation in `escalation.js` |
| Grievance management | `routes/grievances.js` — citizen complaints, officer responses and grievance SLA metrics |
| Monitoring dashboard / SLA compliance | `routes/dashboard.js`, Admin dashboard UI |
| Input and data-quality validation | `backend/validation.js`, structured `DATA_QUALITY_ERROR` responses |
| Configurable service workflows | Admin workflow builder in `routes/admin.js` and `admin.html` |
| Safe JSON persistence | `backend/db.js`, atomic writes protected by a write lock |

## Running it

```bash
cd backend
npm install
node seed.js      # creates backend/data/db.json with demo departments,
                   # services and login accounts (run once, or delete
                   # backend/data/db.json to reset the prototype)
npm start          # http://localhost:4000
```

Open `http://localhost:4000` in a browser.

**Demo logins** (password `password123` for all):

| Role | Email | What you'll see |
|---|---|---|
| Citizen | `asha@example.com` | Apply for services, track applications across departments, manage consent |
| Officer, Revenue Dept | `rohan.rev@gov.in` | Queue of Revenue Dept applications, advance/reject |
| Officer, Skill Dev Dept | `neha.sde@gov.in` | Queue of Skill Development applications |
| Admin | `admin@gov.in` | Cross-department stats, SLA compliance, connector health, audit log |

You can also register a new citizen at `/register.html` — try registering
with the same mobile number as the demo citizen to see the MDM duplicate
check in action.

## Suggested demo script (for a hackathon walkthrough)

1. **Citizen** logs in, applies for "Income Certificate" — note the instant
   "Identity auto-verified via Aadhaar e-KYC connector" message: no document
   re-upload needed.
2. Apply for a second service from a *different* department (e.g. "Skill
   Training Enrollment") — point out both now show up in one tracker.
3. Grant **consent** for the Social Welfare department to pull income data
   from Revenue — this is what lets a scholarship application skip asking
   the citizen for an income certificate they already have.
4. Switch to the **Officer** login for that department, open the queue,
   advance the application through its workflow stages, or reject with a
   reason.
5. Switch back to **Citizen** — show the new notification and updated
   timeline appeared immediately.
6. Switch to **Admin** — show SLA compliance %, per-department completion
   counts, connector call health, and the full audit trail of every action
   taken across every role.

## Extending this into a full production build

### Migrating to a real database

Replace the synchronous `load()` and `save()` implementation in `db.js` with
a Postgres repository while keeping the route-facing operations stable. Create
tables for users, departments, services, applications, consents, audit logs,
notifications, connector logs, grievances, and data-quality flags; preserve the
JSON field shapes as typed columns or JSONB where appropriate. The migration
must retain required-field validation, consent checks before connector reads,
and atomic escalation updates in transactions. Add indexes for citizen,
department, service, status, and expiration lookups, then run a one-time
import that validates existing JSON records before switching the application
to the new connection pool.

- Replace `backend/db.js` with a real database (Postgres recommended) behind
  the same `load()/save()` shape, or refactor each route to use an ORM.
- Replace the mock connectors in `connectors.js` with real integrations
  (Aadhaar e-KYC via UIDAI AUA/KUA, DigiLocker, state SSO like MahaOnline,
  API Setu / X-Road style interoperability standards).
- Move notifications to a real queue (SMS/email gateway) and add WebSocket
  push instead of polling.
- Add a proper workflow engine (e.g. Camunda/Temporal) if workflows need
  parallel approvals, escalations or SLA-driven auto-routing.
- Add a schema/data-quality validation layer per data standard (e.g.
  India Enterprise Architecture / IndEA data exchange specs) before writes.
