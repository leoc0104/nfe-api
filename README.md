# NF-e API

REST API for NF-e (Nota Fiscal Eletrônica) management, built with **NestJS**, **Prisma 6**, and **SQLite**.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [API Endpoints](#api-endpoints)
- [Data Interfaces](#data-interfaces)
- [Getting Started](#getting-started)
- [Environment & Configuration](#environment--configuration)

---

## Features

| Module | Description |
|---|---|
| **Authentication** | Register (name, email, password + confirmation) and login — passwords hashed with bcrypt |
| **JWT Guard** | Protects all `/nfe` routes — returns `401` for missing or invalid tokens |
| **XML Upload** | Accepts NF-e `.xml` files (SEFAZ layout), parses them and persists to the database |
| **NF-e List** | Paginated listing of all imported NF-e documents (without items) |
| **NF-e Detail** | Full NF-e object including all line items |
| **Validation** | Global `ValidationPipe` with `class-validator` — rejects unknown and malformed fields |
| **CORS** | Pre-configured to allow requests from `http://localhost:4200` |

---

## Tech Stack

- **NestJS** — Modular Node.js framework
- **Prisma 6** — ORM with SQLite via binary engine
- **Passport + JWT** — Stateless authentication (`passport-jwt`, `@nestjs/jwt`, 7-day tokens)
- **bcrypt** — Password hashing
- **fast-xml-parser** — SEFAZ NF-e XML parsing
- **class-validator / class-transformer** — DTO validation
- **Docker** — Containerised development environment with hot reload

---

## Project Structure

```
src/
├── auth/                      # Authentication module
│   ├── dto/
│   │   ├── login.dto.ts       # Email + password validation
│   │   └── register.dto.ts    # Email + password (min 6 chars)
│   ├── auth.controller.ts     # POST /auth/register, POST /auth/login
│   ├── auth.module.ts
│   ├── auth.service.ts        # bcrypt hashing, JWT signing
│   ├── jwt-auth.guard.ts      # AuthGuard('jwt') — applied to NFeController
│   └── jwt.strategy.ts        # Passport JWT strategy (reads Bearer token)
├── nfe/                       # NF-e module (listing + upload)
│   ├── nfe.controller.ts      # GET /nfe, GET /nfe/:id, POST /nfe/uploads
│   ├── nfe.module.ts
│   └── nfe.service.ts         # Pagination, detail lookup, XML parsing & persistence
├── prisma/                    # Database module (global)
│   ├── prisma.module.ts       # @Global() — exported to all modules
│   └── prisma.service.ts      # PrismaClient wrapper with onModuleInit
└── main.ts                    # Bootstrap: CORS, global prefix, ValidationPipe
prisma/
├── schema.prisma              # Data models: User, NFe, NFeItem
├── migrations/                # Prisma migration history
└── dev.db                     # SQLite database (created on first run)
```

---

## Architecture Overview

```
HTTP Client (e.g. Angular front-end at :4200)
  │
  │  All requests prefixed with /api/v1
  │
  ├─ POST /api/v1/auth/register ──────► AuthController ──► AuthService ──► PrismaService (User)
  ├─ POST /api/v1/auth/login ─────────► AuthController ──► AuthService ──► JwtService
  │
  └─ [JWT Required]
       ├─ GET  /api/v1/nfe ───────────► NFeController ───► NFeService ───► PrismaService (NFe)
       ├─ GET  /api/v1/nfe/:id ────────► NFeController ───► NFeService ───► PrismaService (NFe + NFeItem)
       └─ POST /api/v1/nfe/uploads ───► NFeController ───► NFeService ───► fast-xml-parser
                                                                                └► PrismaService (NFe + NFeItem)
```

**Module dependency graph:**

```
AppModule
  ├── PrismaModule  (@Global — available everywhere without explicit import)
  ├── AuthModule
  │     └── JwtModule, PassportModule
  └── NFeModule
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Auth

| Method | Path | Auth | Status | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | No | `201` | Create a new user |
| `POST` | `/api/v1/auth/login` | No | `200` | Login, returns a JWT token |

**Register — request body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Register — response (`201`):**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "user@example.com",
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

**Login — response (`200`):**
```json
{
  "access_token": "<jwt>"
}
```

---

### NF-e

All routes require the header: `Authorization: Bearer <token>`

| Method | Path | Status | Description |
|---|---|---|---|
| `GET` | `/api/v1/nfe` | `200` | Paginated list of NF-e documents (no items) |
| `GET` | `/api/v1/nfe/:id` | `200` / `404` | Full NF-e detail including line items |
| `POST` | `/api/v1/nfe/uploads` | `201` / `400` / `409` | Upload and parse an NF-e XML file — returns the created NFe object with items |

**GET `/api/v1/nfe` — query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `limit` | number | `50` | Items per page |

**GET `/api/v1/nfe` — response:**
```json
{
  "data": [ ...NFe[] ],
  "total": 120,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

**POST `/api/v1/nfe/uploads` — request:**
- Content-Type: `multipart/form-data`
- Field name: `file`
- Accepted formats: `.xml` only (SEFAZ NF-e layout)
- Returns `400` for non-XML files
- Returns `409` if the NF-e `access_key` already exists in the database

---

## Data Interfaces

These TypeScript interfaces reflect the exact shape of the Prisma models:

```typescript
export interface NFe {
  id: string;
  access_key: string;      // 44-digit NF-e access key (infNFe @Id, stripped of "NFe" prefix)
  number: string;          // ide > nNF
  series: string;          // ide > serie
  issue_date: Date;        // ide > dhEmi or ide > dEmi
  issuer_name: string;     // emit > xNome
  issuer_cnpj: string;     // emit > CNPJ
  recipient_name: string;  // dest > xNome
  recipient_cnpj: string;  // dest > CNPJ (falls back to CPF for individuals)
  total_value: number;     // total > ICMSTot > vNF
  items: NFeItem[];        // included only on GET /nfe/:id
  created_at: Date;
}

export interface NFeItem {
  id: string;
  code: string;            // det > prod > cProd
  description: string;     // det > prod > xProd
  ncm: string;             // det > prod > NCM
  cfop: string;            // det > prod > CFOP
  quantity: number;        // det > prod > qCom
  unit_price: number;      // det > prod > vUnCom
  total_value: number;     // det > prod > vProd
  nfe_id: string;          // Foreign key to NFe
}

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: Date;
  // password is never returned by any endpoint
  // confirmPassword is only used on registration — never persisted
}
```

---

## Getting Started

**Prerequisites:** Docker and Docker Compose installed.

```bash
# 1. Clone the repository
git clone git@github.com:leoc0104/nfe-api.git
cd nfe-api

# 2. Create the environment file
cp .env.example .env   # or create .env manually (see below)

# 3. Start the container
docker compose up
```

The API will be available at **http://localhost:3000**.

Hot reload is enabled — any file change on the host is picked up automatically inside the container via the volume bind mount.

On first start, the container will:
1. Generate the Prisma client (`npx prisma generate`)
2. Apply all migrations and create `prisma/dev.db` (`npx prisma migrate deploy`)
3. Start the NestJS dev server (`npm run start:dev`)

---

## Environment & Configuration

Create a `.env` file in the project root with the following variables:

```env
DATABASE_URL="file:/app/prisma/dev.db"
JWT_SECRET="your_super_secret_key"
```

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Absolute SQLite path inside the container — maps to `./prisma/dev.db` on your host | `file:/app/prisma/dev.db` |
| `JWT_SECRET` | Secret used to sign and verify JWT tokens | any long random string |
| `PORT` | HTTP port (optional, defaults to `3000`) | `3000` |

> **Note:** Generate a strong `JWT_SECRET` with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

> **Why `file:/app/prisma/dev.db`?** The Prisma CLI resolves `DATABASE_URL` relative to the schema file (`prisma/schema.prisma`), but the running NestJS process resolves it relative to the process working directory (`/app`). Using an absolute path inside the container ensures both the CLI and the app use the same single database file.
