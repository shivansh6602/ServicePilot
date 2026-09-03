# ServicePilot — Architectural Decisions Log (ADR)

This document records key architectural and design decisions made throughout the development of ServicePilot.

---

### Decision 001: Server-Side Calculated Receipts
- **Status:** Approved
- **Context:** Financial receipts can be computed on the frontend or backend.
- **Decision:** Receipt totals will always be calculated server-side from stored line items (`JobPart`, `JobCharge`, `Payment`, `Tip`).
- **Reasoning:** Prevents discrepancies between client UI and backend records, preventing client-side tampering or rounding mismatch.

---

### Decision 002: Service-Layer Multi-Tenant Scoping
- **Status:** Approved
- **Context:** Multi-tenant SaaS requires strict data separation per business tenant.
- **Decision:** Every database query for tenant-owned entities MUST be scoped by `businessId` inside the service layer, derived exclusively from verified JWT or job token.
- **Reasoning:** `businessId` supplied in request bodies/params will NEVER be trusted directly for authorization.
