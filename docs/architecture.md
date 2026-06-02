# LeadFlow — Architecture Documentation

## Project Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (React)                    │
│   Login → Dashboard → Leads → Users → Activity      │
│   AuthContext | React Router | Axios + Interceptors  │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP/JSON
┌─────────────────────▼───────────────────────────────┐
│                EXPRESS.JS (Node.js)                  │
│                                                      │
│  ┌──────────┐  ┌────────────┐  ┌───────────────┐   │
│  │  Routes  │→ │ Controllers │→ │   Services    │   │
│  └──────────┘  └────────────┘  └───────┬───────┘   │
│                                         │            │
│  ┌─────────────────────────────────────▼──────────┐ │
│  │              Middleware Layer                   │ │
│  │  authenticate() | authorize() | validate()      │ │
│  │  errorHandler() | morgan logging                │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                   POSTGRESQL                         │
│  users | leads | activity_logs | refresh_tokens      │
│  agent_assignment_tracker                            │
└─────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              THIRD-PARTY (Email)                     │
│               Nodemailer (SMTP)                      │
└─────────────────────────────────────────────────────┘
```

---

## Database Design

### Entity Relationship Diagram

```
users
  id (PK)
  name
  email (UNIQUE)
  password (bcrypt)
  role: admin | manager | agent
  is_active
  created_at, updated_at

leads
  id (PK)
  name, email, phone
  source: website|referral|social|email|cold_call|event|other
  status: new|contacted|qualified|proposal|negotiation|won|lost
  assigned_to (FK → users.id)
  created_by  (FK → users.id)
  notes
  created_at, updated_at

activity_logs
  id (PK)
  lead_id (FK → leads.id, nullable)
  user_id (FK → users.id, nullable)
  action: LEAD_CREATED | LEAD_UPDATED | LEAD_ASSIGNED |
          STATUS_CHANGED | LEAD_DELETED | USER_REGISTERED |
          USER_LOGIN | USER_LOGOUT
  details (JSONB)
  created_at

refresh_tokens
  id (PK)
  user_id (FK → users.id)
  token (UNIQUE)
  expires_at
  created_at

agent_assignment_tracker
  agent_id (PK, FK → users.id)
  lead_count
  last_assigned_at
```

### Design Decisions
- **JSONB for activity details** — flexible, queryable, no schema migration for new event types
- **Soft delete via is_active** — preserves referential integrity and history
- **Advisory lock** — prevents double-assignment in concurrent scenarios
- **Indexes** on `status`, `source`, `assigned_to`, `created_at` — covers all query patterns
- **Triggers** for `updated_at` auto-update on both `users` and `leads`

---

## Authentication Flow

```
1. POST /auth/login
   ├── Verify email + bcrypt password
   ├── Generate short-lived ACCESS token (1d, JWT)
   ├── Generate long-lived REFRESH token (7d, JWT)
   ├── Store refresh token in DB with expiry
   └── Return both tokens + user object

2. Subsequent requests
   ├── Client sends: Authorization: Bearer <accessToken>
   ├── authenticate() middleware verifies JWT signature
   ├── Checks user exists and is_active in DB
   └── Attaches req.user for downstream use

3. Token refresh (automatic via Axios interceptor)
   ├── 401 response caught by interceptor
   ├── POST /auth/refresh with refreshToken
   ├── Verify refresh token exists in DB + not expired
   ├── Issue new access token
   └── Retry original request

4. POST /auth/logout
   ├── Delete refresh token from DB
   └── Client clears localStorage
```

---

## Lead Assignment Logic

```
POST /leads (manager/admin)
         │
         ▼
   BEGIN TRANSACTION
         │
         ▼
 pg_advisory_xact_lock(12345678)   ← prevents race conditions
         │
         ▼
SELECT agent with MIN(lead_count),
  tie-break by last_assigned_at ASC
         │
   ┌─────┴──────┐
   │            │
No agent    Agent found
found           │
   │            ▼
   │    INSERT/UPDATE agent_assignment_tracker
   │    (lead_count += 1, last_assigned_at = NOW())
   │            │
   └─────┬──────┘
         ▼
  INSERT lead with assigned_to
         │
         ▼
     COMMIT
         │
         ▼
  logActivity(LEAD_CREATED)
  logActivity(LEAD_ASSIGNED)
  sendLeadAssignmentEmail() ← async, non-blocking
```

**Scalability:** Works correctly across multiple Node.js instances because
the lock is at the PostgreSQL level, not in-memory.

---

## Folder Structure

```
backend/src/
├── app.js                    # Express init, middleware, route mounting
├── routes/
│   ├── auth.routes.js        # /api/auth/*
│   ├── lead.routes.js        # /api/leads/*
│   └── user.routes.js        # /api/users/*
├── controllers/
│   ├── auth.controller.js
│   ├── lead.controller.js
│   └── user.controller.js
├── services/
│   ├── auth.service.js       # register, login, refresh, logout
│   ├── lead.service.js       # CRUD + assignment
│   ├── user.service.js       # user management + dashboard stats
│   ├── activityLog.service.js
│   └── assignment.service.js # least-loaded strategy + lock
├── middleware/
│   ├── auth.js               # authenticate, authorize
│   ├── validate.js           # express-validator handler
│   └── errorHandler.js       # global + 404
├── db/
│   ├── index.js              # pg Pool
│   └── migrate.js            # schema + seed
└── utils/
    ├── logger.js             # Winston
    ├── jwt.js                # sign/verify helpers
    ├── email.js              # Nodemailer (3rd party)
    └── response.js           # sendSuccess/sendError/sendPaginated

frontend/src/
├── App.js                    # React Router setup
├── index.js
├── context/
│   └── AuthContext.js        # global auth state
├── pages/
│   ├── LoginPage.js
│   ├── DashboardPage.js
│   ├── LeadsPage.js          # list with pagination/filter/sort
│   ├── LeadFormPage.js       # create + edit
│   ├── LeadDetailPage.js     # view + activity timeline
│   ├── UsersPage.js
│   ├── UserFormPage.js
│   └── ActivityPage.js
├── components/
│   ├── common/ProtectedRoute.js
│   └── layout/Layout.js      # sidebar + main layout
├── services/
│   ├── api.js                # Axios instance + interceptors
│   ├── auth.service.js
│   ├── lead.service.js
│   └── user.service.js
├── utils/
│   └── constants.js          # statuses, sources, formatters
└── styles/
    └── global.css
```

---

## Scalability Considerations

1. **DB Connection Pooling** — `pg.Pool` with max 20 connections
2. **Advisory Locks** — DB-level concurrency control, works multi-instance
3. **Non-blocking email** — fire-and-forget, never blocks HTTP response
4. **Activity log isolation** — failures silently logged, never break main flow
5. **Pagination on all list endpoints** — max 100 items per page enforced
6. **Indexed queries** — all filter/sort columns are indexed
7. **JSONB activity details** — extensible without schema changes

---

## Improvements Possible With More Time

1. **Redis caching** — cache dashboard stats, lead counts
2. **Background job queue** (Bull/BullMQ) — email sending, lead count sync
3. **WebSockets** — real-time dashboard updates
4. **Full-text search** — PostgreSQL tsvector for lead search
5. **Audit middleware** — request-level audit trail
6. **Rate limiting** — express-rate-limit per IP/user
7. **Swagger/OpenAPI** — auto-generated API docs
8. **Unit + integration tests** — Jest + Supertest
9. **Docker Compose** — one-command setup
10. **Deployment** — Railway/Render for backend, Vercel for frontend

---

## Challenges Faced

1. **Race conditions in assignment** — Solved with PostgreSQL advisory locks inside transactions
2. **Token refresh UX** — Axios interceptor handles transparently without user disruption
3. **Role-based field restrictions** — Agents updating leads must be restricted at service layer, not just route layer
4. **Activity log reliability** — Wrapped in try/catch so it never breaks the happy path
