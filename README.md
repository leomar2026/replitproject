# Smart Attendance Biometric System

A full-stack employee attendance system with GPS tracking, WebAuthn biometric authentication, admin dashboard, and CSV report export.

---

## Features

### Attendance Terminal (Public Kiosk)
- Employee clock-in and clock-out with live clock display
- **Two identification methods:**
  - Enter Employee ID manually → Continue
  - Tap **Use Biometric** → fingerprint / Face ID identifies the employee automatically (no ID needed)
- GPS coordinates captured separately at Time In and Time Out
- Employees can self-register their biometric from the terminal after clocking in

### Admin Dashboard
- Overview stats: total employees, present today, late arrivals, absent
- Weekly attendance chart and department breakdown
- Recent activity feed

### Attendance Records
- Searchable and filterable table of all attendance records
- Status badges: On Time, Late, Absent
- CSV export for any date range

### Employee Management
- Add, edit, and delete employees
- Biometric registration built into the Add/Edit form — admin places the device in the employee's hand, taps **Register Biometric**, employee scans their finger or face
- Biometric status shown per employee (registered / not registered)

### Settings
- Configure office start time, late threshold, end time, and workday hours

---

## Getting Started

### Prerequisites
- Node.js 24+
- pnpm 10+
- PostgreSQL database

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | JWT signing secret |

### Install & Run

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm --filter @workspace/db run push

# Start API server (port from $PORT, defaults to 5000)
pnpm --filter @workspace/api-server run dev

# Start frontend (port from $PORT)
pnpm --filter @workspace/attendance-app run dev
```

### Default Admin Credentials
- **Username:** `admin`
- **Password:** `admin123`

---

## Architecture

```
.
├── artifacts/
│   ├── api-server/          # Express 5 REST API
│   └── attendance-app/      # React + Vite frontend
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen
│   ├── api-client-react/    # Generated React Query hooks
│   └── db/                  # Drizzle ORM schema & migrations
└── scripts/                 # Utility scripts
```

### Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, Tailwind CSS, shadcn/ui, wouter |
| API | Express 5, JWT (jsonwebtoken + bcryptjs) |
| Database | PostgreSQL, Drizzle ORM |
| Validation | Zod (zod/v4), drizzle-zod |
| API Codegen | Orval (from OpenAPI spec) |
| Biometric | WebAuthn (@simplewebauthn/server + browser) |
| Charts | Recharts |
| Build | esbuild (CJS bundle) |

---

## Biometric Authentication

This system uses the **WebAuthn standard** (fingerprint, Face ID, Windows Hello) for passwordless employee identification.

### How it works

1. **Registration** — Admin opens Add/Edit Employee, taps **Register Biometric**, hands the device to the employee, employee scans their biometric. The credential is stored server-side linked to their employee record.

2. **Authentication** — On the terminal, employee taps **Use Biometric**. The device matches the stored credential and the server identifies the employee automatically — no ID entry required.

> **Device-bound:** WebAuthn credentials are tied to the device they were registered on. Registration and daily clock-in must happen on the same physical device (e.g., a shared kiosk tablet).

---

## API Overview

All endpoints are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Admin / employee login |
| `GET` | `/auth/me` | Get current user |
| `GET` | `/employees` | List employees |
| `POST` | `/employees` | Create employee |
| `PUT` | `/employees/:id` | Update employee |
| `DELETE` | `/employees/:id` | Delete employee |
| `POST` | `/attendance/time-in` | Clock in |
| `PUT` | `/attendance/:id/time-out` | Clock out |
| `GET` | `/attendance/today/:employeeId` | Today's record |
| `GET` | `/attendance` | List records (admin) |
| `GET` | `/dashboard/stats` | Dashboard statistics |
| `GET` | `/reports/export` | Export CSV |
| `POST` | `/biometric/register/begin` | Start biometric registration |
| `POST` | `/biometric/register/finish` | Complete biometric registration |
| `POST` | `/biometric/discover/begin` | Start discoverable auth (no ID) |
| `POST` | `/biometric/discover/finish` | Complete discoverable auth |
| `GET` | `/biometric/status/:employeeId` | Check registration status |

The full OpenAPI spec is at `lib/api-spec/openapi.yaml`.

---

## Development Notes

- Re-run codegen after any OpenAPI spec change:
  ```bash
  pnpm --filter @workspace/api-spec run codegen
  ```
- Push DB schema changes (dev only):
  ```bash
  pnpm --filter @workspace/db run push
  ```
- Full typecheck:
  ```bash
  pnpm run typecheck
  ```
- JWT is stored in `localStorage` under `attendance_token`
- The terminal page (`/`) is public — no auth required
- Admin routes require `Authorization: Bearer <token>` header
