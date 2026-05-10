# Smart Attendance Biometric System

A daily employee attendance system with GPS tracking, admin dashboard, and report export for managing employee attendance records.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter
- API: Express 5 + JWT auth (jsonwebtoken + bcryptjs)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Charts: Recharts
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/` — Drizzle table definitions (employees, attendance, admins, settings)
- `artifacts/api-server/src/routes/` — Express route handlers (auth, employees, attendance, dashboard, reports)
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware
- `artifacts/attendance-app/src/` — React frontend
  - `src/pages/terminal.tsx` — Employee clock-in/out kiosk (public)
  - `src/pages/dashboard.tsx` — Admin dashboard with stats and charts
  - `src/pages/attendance.tsx` — Attendance records table with export
  - `src/pages/employees.tsx` — Employee management
  - `src/pages/settings.tsx` — Office attendance settings
  - `src/lib/auth.ts` — JWT token storage and getter setup

## Architecture decisions

- JWT stored in `localStorage` under `attendance_token`; passed via `Authorization: Bearer` header via `setAuthTokenGetter` in `custom-fetch.ts`
- Terminal page (`/`) is public — no auth needed for employee clock-in/out
- Admin routes protected by `requireAuth` middleware; admin-only actions by `requireAdmin`
- Attendance status computed server-side at time-in using configurable office start time + late threshold
- CSV export is a direct URL download (not via React Query hook) to trigger browser file save

## Product

- **Attendance Terminal** (`/`): Public kiosk where employees enter their ID, see live clock, and click Time In / Time Out. Automatically captures GPS coordinates.
- **Admin Dashboard** (`/dashboard`): Stats cards, weekly attendance chart, department breakdown, recent activity. Login: `admin` / `admin123`
- **Attendance Records** (`/attendance`): Searchable/filterable table with CSV export
- **Employee Management** (`/employees`): Add, edit, delete employees with drawer form
- **Settings** (`/settings`): Configure office start time, late threshold, end time, workday hours

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always re-run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- `bcryptjs` and `jsonwebtoken` must be in `dependencies` (not `devDependencies`) since they run in production
- The bcrypt hash for seeded admin password `admin123` must be recomputed if changed (cannot import bcryptjs in the code-execution sandbox)
- Seeded admin: username=`admin`, password=`admin123`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
