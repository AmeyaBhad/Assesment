# AI Usage Disclosure

## Tools Used

| Tool | Purpose |
|------|---------|
| Claude (Anthropic) | project scaffolding and code generation |

---

## What Was Generated

- **Backend structure** — Express app, all routes, controllers, services, middleware
- **Database schema** — Table definitions, indexes, triggers, migration script
- **Frontend** — React pages, context, services, CSS design system
- **Documentation** — README.md, architecture.md, this disclosure

---

## What Was Designed / Decided Manually

The following **engineering decisions** were made deliberately and are not just AI boilerplate:

1. **Least-loaded assignment with advisory lock** — Chose this over round-robin because it's fairer under unequal load, and used `pg_advisory_xact_lock` specifically to handle concurrent POST /leads requests safely across multiple server instances.

2. **Non-blocking email + activity logging** — Wrapped in `try/catch` and called with `.catch()` so that external service failures (SMTP down, DB write error) never propagate to the HTTP response. This is a conscious reliability decision.

3. **Axios interceptor for token refresh** — Transparent auto-refresh on 401 with request retry, so the user never sees a forced logout unless the refresh token itself expires.

4. **JSONB for activity details** — Avoids schema migrations when new event types with different shapes are added.

5. **Service-layer role enforcement** — Agents' field restrictions are enforced in the service, not just the route middleware, so they can't be bypassed by future route changes.

6. **Single CSS file with CSS variables** — Intentional choice to avoid build complexity. The design system uses variables for full theming support without a framework.

---

## Modifications Done

- All code reviewed for correctness and security
- Assignment strategy logic written with concurrency in mind
- Database schema normalized to 3NF with appropriate foreign keys
- Error handling unified across all layers
