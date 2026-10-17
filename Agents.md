ServicePilot Backend Rules

- Express + Prisma + PostgreSQL
- JWT authentication
- RBAC
- Tenant isolation through businessId
- Zod validation
- Routes → Controllers → Services
- Business logic belongs in services
- Never trust client-supplied businessId
- Use transactions for multi-write atomic operations
- Preserve existing state machines
- Don't implement future phases
- Don't refactor unrelated code
- Tests required for new workflows