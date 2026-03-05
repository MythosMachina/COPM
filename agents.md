# AGENTS.md

## Project Name

Codex Operator Project Management System

## Purpose

This repository contains a fullstack web application designed to act as an operator control panel for the OpenAI Codex CLI tool.

The system provides:

* Project management
* Task tracking (Active / Done)
* Structured technical documentation
* REST API for Codex integration
* Secure authentication for Operator and Codex API access
* Self-describing API help endpoint

Codex must treat this repository as production-grade infrastructure.

---

## Tech Stack

* Next.js 14 (App Router)
* TypeScript (strict mode)
* PostgreSQL
* Prisma ORM
* NextAuth (Credentials provider)
* Dockerized environment
* REST API architecture

Do not introduce additional frameworks without justification.

---

## Architecture Rules

1. All API logic must live under `/app/api/v1`.
2. Business logic must be separated into a service layer (`/lib/services`).
3. Prisma schema is the single source of truth for the database.
4. No direct database access from route handlers.
5. All API routes must return typed JSON responses.
6. No implicit `any` types.
7. All mutations must validate input using a schema validator (e.g., Zod).

---

## Authentication Model

### Operator (UI Access)

* Username + Password
* NextAuth Credentials Provider
* JWT session strategy
* Password must be hashed with bcrypt

### Codex API

* Authorization header required:
  Authorization: Bearer <CODEX_API_KEY>
* Middleware must validate against ENV variable
* No session required for Codex
* Codex cannot access UI routes

---

## Data Model

### Project

* id: uuid
* name: string
* target: text
* createdAt
* updatedAt

### Documentation

* id: uuid
* projectId: uuid (FK)
* name: string
* content: markdown text
* version: integer (auto increment per document)
* createdAt

### Task

* id: uuid
* projectId: uuid (FK)
* title: string
* status: enum (ACTIVE | DONE)
* istState: text
* sollState: text
* technicalPlan: text
* riskImpact: text
* createdAt
* updatedAt

---

## API Contract

Base path:
`/api/v1`

All endpoints must:

* Return JSON
* Use proper HTTP status codes
* Never return HTML
* Never leak stack traces
* Handle errors centrally

---

## API Help Endpoint

Endpoint:
GET `/api/help`

This endpoint must return:

* API version
* Authentication mechanism
* All endpoints
* Method
* Required body schema
* Example payload
* Example response
* Status codes

This endpoint must always stay synchronized with actual routes.

---

## Coding Standards

* Strict TypeScript
* No unused variables
* No console.log in production
* All environment variables must be validated at boot
* Use async/await
* All DB writes must be wrapped in try/catch
* No silent failures

---

## Testing

* All service layer functions must be unit tested.
* All API routes must have integration tests.
* Use a separate test database.
* No test may depend on execution order.

---

## Pull Request Rules

Codex must:

1. Create feature branches.
2. Write meaningful commit messages.
3. Keep PRs atomic.
4. Include migration if Prisma schema changes.
5. Update API Help endpoint when routes change.
6. Ensure all tests pass before marking PR ready.

---

## Migration Rules

* Never edit the database manually.
* Always use Prisma migration.
* Do not delete columns without backward compatibility strategy.

---

## Deployment Rules

* Application must run via Docker.
* Must expose port 3000.
* Must fail fast if ENV variables are missing.
* Production build must not use development database.

---

## Non-Goals (for MVP)

* No multi-user support.
* No RBAC.
* No external billing.
* No GraphQL.
* No event sourcing.

---

## Long-Term Evolution

Future expansions may include:

* Multi-user system
* Role-based access control
* Webhooks
* Audit trail
* Activity log
* Task comments
* Document version history

Codex must implement MVP first before expanding scope.

---

End of AGENTS.md
