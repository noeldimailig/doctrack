# Document Tracking and Transmittal Management System

Administrative workflow application for recording incoming and outgoing document processing events and producing formal transmittal reports. It tracks **administrative events**, not the physical location of paper documents.

## Current status

**Phase 1 — Foundation implemented.** Included:

- Next.js 16 App Router, TypeScript strict, Tailwind v4 and shadcn/ui
- Drizzle ORM schema and two migrations (`drizzle/`)
- Better Auth authentication with HTTP-only cookie sessions and admin-only account creation
- Custom RBAC tables and server-side permission checks
- Focal-person directory with no authentication relationship
- Append-only audit triggers, status-transition guard, RLS and collision-safe number generation
- Sign-in page, session-aware shell and a real foundation dashboard

Phases 2–7 (user/organisation management, document workflow, transmittals, reports and tests) are still to be implemented.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your values
npm run db:migrate
npm run db:seed
npm run admin:create
npm run dev
```

Open `http://localhost:3000`.

Verification:

```bash
npm run typecheck
npm run lint
npm run build
```

## Documentation

- `docs/ARCHITECTURE.md` — approved architecture, ER design, workflow, transaction boundaries and decisions
- `docs/SETUP.md` — setup and verification steps
- `docs/ENVIRONMENT.md` — every environment variable
- `docs/AUTH_TOKEN_STRATEGY.md` — why Better Auth sessions are canonical and no second token system exists

## Key rules

1. Focal persons are organisational records and never get application accounts.
2. Receiving personnel record focal-person decisions; `focal_person_id` and `recorded_by` are always separate.
3. Repeated return/correction/re-forward cycles are preserved as new events.
4. Statuses change only through validated workflow actions, never arbitrary UI edits.
5. Finalised transmittals keep snapshots and cannot contain the same document twice.
