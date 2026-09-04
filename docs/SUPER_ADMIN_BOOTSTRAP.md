# TBK Market — First Super Admin Bootstrap Guide

## 1. Purpose
The Super Admin Bootstrap mechanism provides a secure, deterministic, and non-public method to create the **very first `SUPER_ADMIN` account** for the TBK Market Administrative Control Center.

There is **NO public registration** for admin accounts. The first Super Admin must be created through this developer/system bootstrap command. Once initialized, the Super Admin logs into the Admin Control Center to invite and manage other operational administrators (`DIRECTION_ADMIN`, `COMMERCE_ADMIN`, `FINANCE_SUPPORT_ADMIN`, `TECHNICAL_ADMIN`).

---

## 2. When to Use
- **Initial Environment Setup**: During initial deployment in local development, staging, or production environments when the `admin_users` table has no `SUPER_ADMIN` account.
- **Disaster Recovery**: Setting up a freshly restored database without existing Super Admin accounts.

> **Important**: This command is strictly for bootstrapping the **first** Super Admin. It is NOT the routine mechanism for creating admin users. All subsequent admins must be created from inside the Admin Control Center.

---

## 3. Required Environment Variables

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN_EMAIL` | Unique email for the inaugural Super Admin | **Yes** | `admin@tbk.market` |
| `SUPER_ADMIN_PASSWORD` | Strong password (hashed via bcrypt; never stored in plaintext) | **Yes** | `StrongBootstrapPass2026!` |
| `SUPER_ADMIN_NAME` | Full name of the Super Admin (split to first & last name) | Optional | `Gauthier Bofi` (defaults to `Super Admin`) |

---

## 4. How to Run

### A. Via Docker (Recommended in Containerized Environments)
The binary `/app/create-superadmin` is pre-compiled inside the API Docker image.

#### Using `docker compose exec` (on running stack):
```powershell
docker compose exec `
  -e SUPER_ADMIN_NAME="Gauthier Bofi" `
  -e SUPER_ADMIN_EMAIL="admin@tbk.market" `
  -e SUPER_ADMIN_PASSWORD="StrongTemporaryPassword123!" `
  api ./create-superadmin
```

#### Using `docker compose run` (one-off container):
```powershell
docker compose run --rm `
  -e SUPER_ADMIN_NAME="Gauthier Bofi" `
  -e SUPER_ADMIN_EMAIL="admin@tbk.market" `
  -e SUPER_ADMIN_PASSWORD="StrongTemporaryPassword123!" `
  api ./create-superadmin
```

### B. Local Go Execution (Host Development Machine)
Make sure the database host and port match your local PostgreSQL configuration (e.g. host port `5433` if using Docker Postgres from host):

```powershell
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="5433"
$env:SUPER_ADMIN_NAME="Gauthier Bofi"
$env:SUPER_ADMIN_EMAIL="admin@tbk.market"
$env:SUPER_ADMIN_PASSWORD="StrongTemporaryPassword123!"

cd backend
go run ./cmd/create-superadmin
```

---

## 5. Idempotency & Safety Rules

1. **First-Super-Admin Rule**:
   Before creating any record, the command queries `SELECT COUNT(*) FROM admin_users WHERE role = 'SUPER_ADMIN'`.
   If one or more Super Admins already exist, the command safely exits with exit code `0` and outputs:
   ```
   [INFO] SUPER_ADMIN already exists. Bootstrap skipped.
   ```
   Running the bootstrap multiple times will **never** create duplicate accounts or mutate passwords.

2. **Email Conflict Protection**:
   If the specified email already exists in `admin_users` under another role (e.g. `COMMERCE_ADMIN`), the command refuses to overwrite or silently upgrade the user and exits with an error.

3. **Secure Password Hashing**:
   Passwords are never stored in plaintext. They are hashed using standard `bcrypt` matching the backend's authentication service. Passwords are never logged.

4. **Immutable Audit Trail**:
   Upon creation, an inaugural audit entry is recorded in `admin_audit_log` with action `SUPER_ADMIN_BOOTSTRAP_CREATED`, referencing the newly created Super Admin's ID without violating foreign key constraints.

5. **Protection of the Last Super Admin**:
   The system enforces the business invariant that at least one `ACTIVE` `SUPER_ADMIN` must exist. The last active Super Admin cannot be suspended, deactivated, or downgraded.

---

## 6. Admin Authentication & Dashboard Access

After running the bootstrap, the Super Admin can immediately log in:

- **Login Endpoint**: `POST /api/v1/admin/auth/login`
- **Web Admin URL**: `http://localhost:5173/admin/login` (or production admin domain)
- **Token Type**: Bearer Admin JWT (audience: `admin`)
- **Authorized Dashboards**:
  - **Dashboard 1**: Direction & Governance (`/api/v1/admin/direction/*`)
  - **Dashboard 2**: Commerce & Operations (`/api/v1/admin/commerce/*`)
  - **Dashboard 3**: Finance, Support & Trust (`/api/v1/admin/finance/*`)
  - **Dashboard 4**: Technical & Security (`/api/v1/admin/technical/*`)
  - **Platform Controls**: Feature Flags, Global Config & Audit Log (`/api/v1/admin/platform/*`, `/api/v1/admin/audit/*`)

---

## 7. Security Warnings
- **Do NOT commit passwords** to `.env`, version control, or configuration files.
- **Do NOT create public admin registration routes** (`/admin/register`).
- **Do NOT use default passwords** such as `admin/admin`. Always specify a strong password via environment variables during bootstrap.
