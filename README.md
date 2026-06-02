# 🚀 LeadFlow — Mini Lead Management System

A full-stack Lead Management System built with **Node.js + Express + PostgreSQL** (backend) and **React.js** (frontend). Supports JWT authentication, role-based access control, lead auto-assignment, activity logging, and third-party email integration.

---

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Roles & Permissions](#roles--permissions)
- [Lead Assignment Logic](#lead-assignment-logic)
- [Third-Party Integration](#third-party-integration)
- [Assumptions](#assumptions)
- [Tradeoffs](#tradeoffs)

---

## Project Overview

LeadFlow allows managers to create leads which are **automatically assigned** to agents using a **least-loaded assignment strategy**. The system supports full CRUD operations, activity logging, email notifications, and a responsive React dashboard.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Backend   | Node.js, Express.js               |
| Database  | PostgreSQL (local or Supabase)    |
| Auth      | JWT (access + refresh tokens)     |
| Frontend  | React.js, React Router v6         |
| Email     | Nodemailer (SMTP / Gmail)         |
| Logging   | Winston                           |
| Styling   | Custom CSS (dark theme)           |

---

## Architecture

```
lead-management/
├── backend/
│   └── src/
│       ├── app.js              # Express app entry
│       ├── routes/             # Route definitions
│       ├── controllers/        # Request handlers
│       ├── services/           # Business logic
│       ├── middleware/         # Auth, validation, errors
│       ├── db/                 # DB pool + migrations
│       └── utils/              # Logger, JWT, email, responses
├── frontend/
│   └── src/
│       ├── App.js              # Routing
│       ├── pages/              # Full page components
│       ├── components/         # Reusable UI components
│       ├── context/            # AuthContext
│       ├── services/           # API call abstractions
│       ├── utils/              # Constants, formatters
│       └── styles/             # Global CSS
├── docs/
│   └── architecture.md
└── README.md
```

### Request Flow
```
Client → React (Axios) → Express Router → Middleware (Auth/Validate) → Controller → Service → DB
                                                                          ↓
                                                                    Response Helper
```

---

## Setup Instructions

### Prerequisites
- Node.js v18+
- PostgreSQL 14+ (or free Supabase account)
- npm or yarn

### 1. Clone & Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## Environment Configuration

### Backend — `backend/.env`
Copy from `.env.example`:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
PORT=5000
NODE_ENV=development

# PostgreSQL (default — mandatory per tech stack)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=lead_management
DB_USER=postgres
DB_PASSWORD=yourpassword

# Set to true ONLY for local dev without a PostgreSQL instance (uses SQLite fallback)
# USE_SQLITE=true

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

# Email (optional — Nodemailer / Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=LeadFlow <your@gmail.com>

FRONTEND_URL=http://localhost:3000
```

> **Gmail setup:** Enable 2FA → Generate an App Password → use it as `EMAIL_PASS`
> **No PostgreSQL locally?** Uncomment `USE_SQLITE=true` above, or use a free [Supabase](https://supabase.com) database.

### Frontend — `frontend/.env`
```bash
cp frontend/.env.example frontend/.env
```
```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## Database Setup

### Option A: Local PostgreSQL
```bash
psql -U postgres
CREATE DATABASE lead_management;
\q
```

### Option B: Supabase (Free)
1. Create a project at [supabase.com](https://supabase.com)
2. Go to Project Settings → Database
3. Copy the connection string and update `.env`

### Run Migrations

**Option A — Node.js script (recommended, includes seeding):**
```bash
cd backend
npm run migrate
```

**Option B — Raw SQL (psql):**
```bash
psql -U postgres -d lead_management -f backend/migrations/001_initial_schema.sql
```

Both options create all tables, indexes, triggers, and seed a default admin user:
- **Email:** `admin@leadmanager.com`
- **Password:** `Admin@123`

> See `docs/database-design.md` for the full ER diagram and schema explanation.

---

## Running the Application

### Development

```bash
# Terminal 1 — Backend
cd backend
npm run dev          # Runs on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm start            # Runs on http://localhost:3000
```

### Production
```bash
# Backend
cd backend
NODE_ENV=production npm start

# Frontend
cd frontend
npm run build
# Serve the build/ folder with nginx or any static host
```

---

## API Documentation

Base URL: `http://localhost:5000/api`

All protected routes require:
```
Authorization: Bearer <accessToken>
```

---

### Authentication

#### `POST /auth/login`
```json
// Request
{ "email": "admin@leadmanager.com", "password": "Admin@123" }

// Response
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "...", "name": "System Admin", "email": "...", "role": "admin" }
  }
}
```

#### `POST /auth/register` *(Admin only)*
```json
{ "name": "Jane Agent", "email": "jane@co.com", "password": "Pass@123", "role": "agent" }
```

#### `POST /auth/refresh`
```json
{ "refreshToken": "eyJ..." }
```

#### `POST /auth/logout` *(Protected)*
```json
{ "refreshToken": "eyJ..." }
```

#### `GET /auth/me` *(Protected)*
Returns current user profile.

---

### Leads

#### `GET /leads` *(Protected)*
Query params: `page`, `limit`, `search`, `status`, `source`, `sortBy`, `sortOrder`

```json
// Response
{
  "success": true,
  "data": [ { "id": "...", "name": "...", "status": "new", "assigned_to_name": "..." } ],
  "pagination": { "total": 42, "page": 1, "limit": 10, "totalPages": 5 }
}
```

#### `POST /leads` *(Admin, Manager)*
```json
{
  "name": "Acme Corp",
  "email": "contact@acme.com",
  "phone": "+91 9876543210",
  "source": "website",
  "status": "new",
  "notes": "Interested in enterprise plan"
}
```
Lead is **auto-assigned** to an agent on creation.

#### `GET /leads/:id` *(Protected)*

#### `PUT /leads/:id` *(Protected)*
Agents can only update `status` and `notes`.

#### `DELETE /leads/:id` *(Admin, Manager)*

#### `GET /leads/:id/activity`
Returns activity timeline for a lead.

---

### Users

#### `GET /users` *(Admin, Manager)*
Query params: `role`, `page`, `limit`

#### `GET /users/:id` *(Admin, Manager)*

#### `PUT /users/:id` *(Admin only)*

#### `GET /users/dashboard` *(Admin, Manager)*
Returns stats: total leads, by status, by source, agent performance.

#### `GET /users/activity` *(Admin, Manager)*
Returns paginated system-wide activity log.

---

## Roles & Permissions

| Action                  | Admin | Manager | Agent |
|-------------------------|:-----:|:-------:|:-----:|
| Register users          | ✅    | ❌      | ❌    |
| View all leads          | ✅    | ✅      | ❌    |
| View own leads          | ✅    | ✅      | ✅    |
| Create leads            | ✅    | ✅      | ❌    |
| Update any lead         | ✅    | ✅      | ❌    |
| Update own lead status  | ✅    | ✅      | ✅    |
| Delete leads            | ✅    | ✅      | ❌    |
| View users              | ✅    | ✅      | ❌    |
| Edit users              | ✅    | ❌      | ❌    |
| View dashboard          | ✅    | ✅      | ❌    |
| View activity feed      | ✅    | ✅      | ❌    |

---

## Lead Assignment Logic

When a manager creates a lead, it is automatically assigned to an agent using the **Least-Loaded Assignment** strategy:

1. Query all active agents ordered by `lead_count ASC`, then `last_assigned_at ASC` (tie-break)
2. Assign the lead to the agent with the fewest active leads
3. Increment that agent's counter in `agent_assignment_tracker`
4. All of this happens inside a **PostgreSQL transaction** with an **advisory lock** (`pg_advisory_xact_lock`) to prevent race conditions in concurrent scenarios

Benefits over pure round-robin:
- Handles agents that were added mid-stream
- Accounts for leads being closed/deleted (counters are decremented)
- Scalable — no in-memory state needed, works across multiple server instances

---

## Third-Party Integration

### Email — Nodemailer (SMTP)

Used for:
- **Lead assignment notifications** — agent receives an email when a lead is assigned to them
- **Welcome emails** — new users get a welcome email on registration

The integration uses async/non-blocking calls so email failures never break the main flow. Fully configurable via environment variables (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`).

---

## Assumptions

1. **Admin-only registration** — new users are created by admins, not self-registered
2. **Auto-assignment only** — leads are always auto-assigned; manual re-assignment is available via the edit lead form
3. **Soft deactivation** — users are deactivated (`is_active = false`) not hard deleted
4. **Agent visibility** — agents only see leads assigned to them
5. **Email is optional** — the app works fully without email credentials configured

---

## Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| Advisory lock for assignment | Slightly slower under heavy concurrency vs. optimistic locking, but simpler and safer |
| JWT stateless access tokens | Cannot revoke individual access tokens without a blacklist; mitigated with short expiry (1d) |
| Single-table activity log | Simple to query but may need partitioning at very high scale |
| Least-loaded vs. round-robin | Least-loaded is fairer but requires a counter table; pure round-robin would be simpler |
| Custom CSS (no framework) | Full control over design, no bloat, but more code to maintain |

---

## Default Credentials (After Migration)

| Role  | Email                    | Password   |
|-------|--------------------------|------------|
| Admin | admin@leadmanager.com    | Admin@123  |
