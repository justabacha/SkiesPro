# Admin Module

## Purpose

The admin module provides backend APIs for administrative oversight, RBAC enforcement, audit logging, compliance monitoring, and operational reporting for the SkiesPro platform.

## Security constraints

- All admin routes require a valid JWT with `mfa_verified: true` for write operations.
- Supported admin roles are `support`, `finance`, `risk_manager`, `compliance`, `admin`, and `super_admin`.
- All changes are recorded to `admin.audit_logs` with a SHA-256 chaining hash.
- Wallet adjustments above $500 require a second super-admin approval via the `PUT /api/v1/admin/actions/:id/approve` endpoint.

## Route prefix

- `/api/v1/admin`
