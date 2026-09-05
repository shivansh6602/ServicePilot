# ServicePilot

ServicePilot is a multi-tenant SaaS operating system designed for small service businesses (HVAC, AC repair, electricians, plumbers, appliance repair). It streamlines operations from customer request, job scheduling, field technician updates, photo upload, customer sign-off, manual payment recording, and digital receipt generation.

## System Architecture

```text
┌─────────────────┐       ┌─────────────────┐
│ Owner App       │       │ Customer Link   │
│ (Next.js / TS)  │       │ (Next.js / TS)  │
└────────┬────────┘       └────────┬────────┘
         │ JWT (httpOnly)          │ Job Token
         └────────────┬────────────┘
                      ▼
        ┌───────────────────────────┐
        │   Express API Server      │
        │   (Routes -> Controllers  │
        │    -> Services -> Prisma) │
        └─────────────┬─────────────┘
                      ▼
        ┌───────────────────────────┐
        │    PostgreSQL Database    │
        │    (Multi-tenant Data)    │
        └───────────────────────────┘
```

## Repository Layout
- `backend/`: Express API server, Zod validation, Prisma ORM, multi-tenant middleware.
- `frontend/`: Next.js & TypeScript client application (Phase 8+).

## Tech Stack
- **Backend:** Node.js, Express, PostgreSQL, Prisma ORM, Zod, JWT.
- **Frontend:** Next.js, TypeScript (Phase 8+).
- **Database:** PostgreSQL running in Docker (`servicepilot-postgres`).
