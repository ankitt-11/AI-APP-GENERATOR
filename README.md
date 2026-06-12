# AI App Generator — Production-Grade Metadata-Driven Application Runtime

The **AI App Generator** is a metadata-driven SaaS platform that dynamically interprets JSON schemas at runtime to render fully functional applications — including web frontends, backend APIs, data persistence, and workflow automation — without generating static source files or rebuilding application bundles.

Unlike traditional low-code/no-code generators, **metadata is never compiled into code**. Instead, a single core engine acts as a dynamic interpreter. This enables instant previewing, zero-rebuild hot patching, and schema recovery options.

---

## 🚀 Key Features

*   **Runtime interpretation Engine**: Interprets entity and layout definitions on every request. Supports custom field types (`text`, `number`, `email`, `boolean`, `date`, `select`).
*   **AI Schema Assistant**: Scans metadata schema against layout heuristics and best practices to suggest improvements, providing one-click auto-repair.
*   **CSV Import Wizard**: Supports batch CSV uploads, infers column data types, suggests target field mappings, and reports validation errors in a quarantined log.
*   **Workflow Automation**: Sync triggers (`record_created`, `record_updated`, `record_deleted`) that execute actions (`create_notification`, `create_record`, `log_event`) in a unified transaction.
*   **Security & Ownership**: Route-level ownership verification and JWT token authorization block cross-tenant database access.

---

## 🛠️ Architecture & Monorepo Structure

Built as a **Turborepo monorepo** to share validation schemas and TypeScript types between the NestJS backend and Next.js frontend, preventing type drift.

```
d:\AI APP GENERATOR\
├── apps/
│   ├── api/                          # NestJS REST API Gateway (port 3001)
│   └── web/                          # Next.js 15 App Router client (port 3000)
├── packages/
│   └── shared/                       # Shared type declarations & Zod validators
├── docker/
│   ├── Dockerfile.api                # Docker packaging for NestJS application
│   ├── Dockerfile.web                # Docker packaging for Next.js app
│   └── docker-compose.yml            # Orchestrates Postgres + API + Web containers
├── package.json                      # Monorepo workspace configuration
└── turbo.json                        # Turborepo task pipeline config
```

---

## 💾 Database Schema

The database model is entity-agnostic. Relational integrity is enforced using PostgreSQL constraints, while dynamic user records are stored as nested JSONB schemas inside a single `entity_records` table:

```
                  ┌──────────┐
                  │  users   │
                  └────┬─────┘
                       │ 1
                       │
                       ▼ *
                  ┌──────────┐
                  │   apps   │
                  └────┬─────┘
                       │ 1
                       ├──────────────────────┐
                       │ *                    │ *
                       ▼                      ▼
               ┌──────────────┐       ┌──────────────┐
               │   entities   │       │  workflows   │
               └──────┬───────┘       └──────┬───────┘
                      │ 1                    │ 1
                      ├──────────────┐       ▼ *
                      │ *            │ *   ┌──────────────┐
                      ▼              ▼     │workflow_runs │
              ┌──────────────┐ ┌──────────┐└──────────────┘
              │ entity_fields│ │  entity  │
              └──────────────┘ │ _records │
                               └──────────┘
```

---

## 🏁 Local Quickstart

### 1. Requirements
*   Node.js v20+
*   npm v10+
*   Docker & Docker Compose (optional, for DB)

### 2. Configure Environment Variables
Copy `.env.example` to create configuration files:
```bash
# Set up root configurations
cp .env.example .env
```

### 3. Start Database Container
```bash
# Launch PostgreSQL
docker compose up postgres -d
```

### 4. Install Dependencies
```bash
# From workspace root
npm install
```

### 5. Run Database Migrations and Seed
```bash
# Run prisma migrations & populate seed data (demo credentials)
npm run db:migrate
npm run db:seed
```

*   **Demo Username**: `demo@aiappgen.com`
*   **Demo Password**: `password123`

### 6. Boot Development Servers
```bash
# Launches NestJS API (3001) and Next.js Web (3000) concurrently
npm run dev
```

---

## 🐳 Docker Deployment

To launch the entire platform in a production-ready, networked container group:

```bash
# Build & start all services (postgres, api gateway, next.js frontend)
docker compose up --build -d
```

Access the frontend dashboard at `http://localhost:3000` and the API gateway playground at `http://localhost:3001`.

---

## 🧪 Testing Guidelines

Unit and integration tests can be run from the root directory:

```bash
# Run type checks across all workspaces
npm run type-check

# Run linter
npm run lint

# Run Jest tests
npm run test
```
