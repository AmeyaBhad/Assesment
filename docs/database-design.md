# LeadFlow — Database Design & ER Diagram

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ENTITY RELATIONSHIPS                        │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────────────────────────────┐
│     USERS       │         │                  LEADS                   │
├─────────────────┤         ├──────────────────────────────────────────┤
│ id (PK)         │◄───┐    │ id (PK)                                  │
│ name            │    │    │ name                                     │
│ email (UNIQUE)  │    │    │ email                                    │
│ password        │    │    │ phone                                    │
│ role            │    │    │ source                                   │
│ is_active       │    │    │ status                                   │
│ created_at      │    ├────│ assigned_to (FK → users.id)              │
│ updated_at      │    │    │ created_by  (FK → users.id)  NOT NULL    │
└─────────────────┘    │    │ notes                                    │
        │              │    │ created_at                               │
        │ 1            │    │ updated_at                               │
        │              │    └──────────────────────────────────────────┘
        │              │                    │
        │              │                    │ 1
        │              │                    │
        │ N            │                    │ N
        ▼              │                    ▼
┌─────────────────┐    │    ┌──────────────────────────────────────────┐
│ REFRESH_TOKENS  │    │    │             ACTIVITY_LOGS                │
├─────────────────┤    │    ├──────────────────────────────────────────┤
│ id (PK)         │    │    │ id (PK)                                  │
│ user_id (FK)    │────┘    │ lead_id (FK → leads.id, nullable)        │
│ token (UNIQUE)  │         │ user_id (FK → users.id, nullable)        │
│ expires_at      │         │ action  (enum-like VARCHAR)              │
│ created_at      │         │ details (JSONB)                          │
└─────────────────┘         │ created_at                               │
                            └──────────────────────────────────────────┘

┌────────────────────────────────────┐
│     AGENT_ASSIGNMENT_TRACKER       │
├────────────────────────────────────┤
│ agent_id (PK, FK → users.id)       │  ← 1:1 with users (role=agent)
│ lead_count     INTEGER DEFAULT 0   │
│ last_assigned_at TIMESTAMPTZ       │
└────────────────────────────────────┘
```

---

## Relationships

| From          | To           | Type  | FK Column         | On Delete      |
|---------------|--------------|-------|-------------------|----------------|
| leads         | users        | N:1   | assigned_to       | SET NULL       |
| leads         | users        | N:1   | created_by        | RESTRICT       |
| activity_logs | leads        | N:1   | lead_id           | CASCADE        |
| activity_logs | users        | N:1   | user_id           | SET NULL       |
| refresh_tokens| users        | N:1   | user_id           | CASCADE        |
| agent_tracker | users        | 1:1   | agent_id          | CASCADE        |

---

## Table Descriptions

### `users`
Stores all system users — admins, managers, and agents. Passwords are stored as bcrypt hashes (cost 10). The `role` field drives all authorization logic.

**Constraints:**
- `email` UNIQUE — prevents duplicate accounts
- `role` CHECK — only 'admin', 'manager', 'agent' allowed
- `is_active` — soft deactivation, preserves referential integrity

### `leads`
Core business entity. Each lead has exactly one creator (`created_by`) and optionally one assigned agent (`assigned_to`). The `status` field follows a defined pipeline: `new → contacted → qualified → proposal → negotiation → won/lost`.

**Constraints:**
- `status` CHECK — enforces valid pipeline stages
- `source` CHECK — enforces valid lead sources
- `created_by` NOT NULL, RESTRICT on delete — lead history preserved

### `activity_logs`
Append-only audit trail. Uses JSONB `details` for flexible per-action payloads without requiring schema changes for new event types. Both `lead_id` and `user_id` are nullable to support system-level events.

**Tracked actions:**
- `LEAD_CREATED`, `LEAD_UPDATED`, `LEAD_DELETED`
- `LEAD_ASSIGNED`, `STATUS_CHANGED`
- `USER_REGISTERED`, `USER_LOGIN`, `USER_LOGOUT`

### `refresh_tokens`
Stores active JWT refresh tokens for revocation support. Each token has an `expires_at` — expired tokens are automatically excluded from queries. On logout, the token is hard-deleted.

### `agent_assignment_tracker`
Supports the least-loaded assignment strategy. Maintains a per-agent running count of assigned leads. Updated inside a transaction with `pg_advisory_xact_lock` to prevent race conditions.

---

## Indexes

| Index Name                  | Table          | Column(s)    | Purpose                          |
|-----------------------------|----------------|--------------|----------------------------------|
| idx_leads_status            | leads          | status       | Filter by pipeline stage         |
| idx_leads_source            | leads          | source       | Filter by lead source            |
| idx_leads_assigned_to       | leads          | assigned_to  | Agent's lead list query          |
| idx_leads_created_by        | leads          | created_by   | Manager's lead list query        |
| idx_leads_created_at        | leads          | created_at   | Default sort (DESC)              |
| idx_activity_logs_lead      | activity_logs  | lead_id      | Per-lead activity timeline       |
| idx_activity_logs_time      | activity_logs  | created_at   | Global feed sort                 |
| idx_users_role              | users          | role         | Filter agents for assignment     |
| idx_users_email             | users          | email        | Login lookup                     |
| idx_refresh_tokens_uid      | refresh_tokens | user_id      | Logout (delete all tokens)       |

---

## Design Decisions

1. **UUID primary keys** — globally unique, no auto-increment contention, safer to expose in URLs
2. **TIMESTAMPTZ** — timezone-aware timestamps throughout; avoids daylight saving bugs
3. **JSONB activity details** — flexible per-event payload; no migration needed for new event types
4. **CHECK constraints** — data integrity enforced at DB level, not just application layer
5. **ON DELETE strategies chosen carefully:**
   - `assigned_to` → SET NULL: lead survives agent deletion
   - `created_by` → RESTRICT: cannot delete a user who has created leads (preserves audit)
   - `activity_logs.lead_id` → CASCADE: logs deleted with their lead
   - `refresh_tokens.user_id` → CASCADE: tokens auto-cleaned when user deleted
6. **Triggers for `updated_at`** — zero-overhead automatic timestamp updates via PL/pgSQL
7. **Soft-delete users** (`is_active = false`) — preserves FK references and history
