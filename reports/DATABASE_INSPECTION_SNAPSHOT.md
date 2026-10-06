# DATABASE INSPECTION SNAPSHOT

> **Generated At**: 2026-10-05T20:11:20.232Z
> **Environment**: development
> **Database Host / Connection**: postgresql://postgres.sajkjbbhhblafhelesey:****@aws-0-us-east-1.pooler.supabase.com:6543/postgres
> **Diagnostic Mode**: Strictly Read-Only

---

## §1 Executive Summary

| Metric | Value |
|--------|-------|
| **Total Custom Schemas** | 15 |
| **Total Tables** | 81 |
| **Total Foreign Keys** | 24 |
| **Total Active RLS Policies** | 0 |
| **Registered Users Count** | 8 |

---

## §2 Schema & Table Inventory (With Exact Row Counts)

### Schema: `admin`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `admin_actions` | **0** | ❌ NO | ❌ NO |
| `audit_logs` | **0** | ❌ NO | ❌ NO |
| `job_history` | **0** | ❌ NO | ❌ NO |
| `support_tickets` | **0** | ❌ NO | ❌ NO |
| `system_jobs` | **0** | ❌ NO | ❌ NO |

### Schema: `app_auth`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `mfa_tokens` | **0** | ❌ NO | ❌ NO |
| `password_history` | **0** | ❌ NO | ❌ NO |
| `password_reset_tokens` | **0** | ❌ NO | ❌ NO |
| `permissions` | **18** | ❌ NO | ❌ NO |
| `role_permissions` | **42** | ❌ NO | ❌ NO |
| `roles` | **7** | ❌ NO | ❌ NO |
| `sessions` | **17** | ❌ NO | ❌ NO |
| `user_roles` | **8** | ❌ NO | ❌ NO |
| `users` | **8** | ❌ NO | ❌ NO |

### Schema: `auth`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `audit_log_entries` | **0** | ✅ YES | ❌ NO |
| `custom_oauth_providers` | **0** | ❌ NO | ❌ NO |
| `flow_state` | **0** | ✅ YES | ❌ NO |
| `identities` | **7** | ✅ YES | ❌ NO |
| `instances` | **0** | ✅ YES | ❌ NO |
| `mfa_amr_claims` | **4** | ✅ YES | ❌ NO |
| `mfa_challenges` | **0** | ✅ YES | ❌ NO |
| `mfa_factors` | **0** | ✅ YES | ❌ NO |
| `mfa_recovery_code_sets` | **0** | ❌ NO | ❌ NO |
| `mfa_recovery_codes` | **0** | ❌ NO | ❌ NO |
| `oauth_authorizations` | **0** | ❌ NO | ❌ NO |
| `oauth_client_states` | **0** | ❌ NO | ❌ NO |
| `oauth_clients` | **0** | ❌ NO | ❌ NO |
| `oauth_consents` | **0** | ❌ NO | ❌ NO |
| `one_time_tokens` | **0** | ✅ YES | ❌ NO |
| `refresh_tokens` | **4** | ✅ YES | ❌ NO |
| `saml_providers` | **0** | ✅ YES | ❌ NO |
| `saml_relay_states` | **0** | ✅ YES | ❌ NO |
| `schema_migrations` | **82** | ✅ YES | ❌ NO |
| `scim_tokens` | **0** | ❌ NO | ❌ NO |
| `scim_users` | **0** | ❌ NO | ❌ NO |
| `sessions` | **4** | ✅ YES | ❌ NO |
| `sso_domains` | **0** | ✅ YES | ❌ NO |
| `sso_providers` | **0** | ✅ YES | ❌ NO |
| `users` | **7** | ✅ YES | ❌ NO |
| `webauthn_challenges` | **0** | ❌ NO | ❌ NO |
| `webauthn_credentials` | **0** | ❌ NO | ❌ NO |

### Schema: `compliance`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `aml_flags` | **0** | ❌ NO | ❌ NO |
| `compliance_rules` | **0** | ❌ NO | ❌ NO |
| `kyc_documents` | **0** | ❌ NO | ❌ NO |

### Schema: `config`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `feature_flags` | **5** | ❌ NO | ❌ NO |
| `platform_settings` | **11** | ❌ NO | ❌ NO |

### Schema: `events`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `event_outbox` | **1** | ❌ NO | ❌ NO |

### Schema: `notifications`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `notification_queue` | **0** | ❌ NO | ❌ NO |
| `notifications` | **0** | ❌ NO | ❌ NO |

### Schema: `payments`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `deposits` | **0** | ❌ NO | ❌ NO |
| `idempotency_keys` | **0** | ❌ NO | ❌ NO |
| `payment_gateways` | **1** | ❌ NO | ❌ NO |
| `payment_webhook_logs` | **0** | ❌ NO | ❌ NO |
| `withdrawals` | **0** | ❌ NO | ❌ NO |

### Schema: `pricing`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `candles` | **10,686** | ❌ NO | ❌ NO |
| `market_hours` | **7** | ❌ NO | ❌ NO |
| `price_ticks` | **289,621** | ❌ NO | ❌ NO |

### Schema: `realtime`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `messages` | **0** | N/A | N/A |
| `schema_migrations` | **88** | ❌ NO | ❌ NO |
| `subscription` | **0** | ❌ NO | ❌ NO |

### Schema: `referral`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `referral_codes` | **0** | ❌ NO | ❌ NO |
| `referral_commissions` | **0** | ❌ NO | ❌ NO |
| `referrals` | **0** | ❌ NO | ❌ NO |

### Schema: `storage`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `buckets` | **1** | ✅ YES | ❌ NO |
| `buckets_analytics` | **0** | ✅ YES | ❌ NO |
| `buckets_vectors` | **0** | ✅ YES | ❌ NO |
| `migrations` | **73** | ✅ YES | ❌ NO |
| `objects` | **0** | ✅ YES | ❌ NO |
| `s3_multipart_uploads` | **0** | ✅ YES | ❌ NO |
| `s3_multipart_uploads_parts` | **0** | ✅ YES | ❌ NO |
| `vector_indexes` | **0** | ✅ YES | ❌ NO |

### Schema: `trading`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `asset_config` | **7** | ❌ NO | ❌ NO |
| `assets` | **7** | ❌ NO | ❌ NO |
| `binary_contracts` | **0** | ❌ NO | ❌ NO |
| `contract_events` | **0** | ❌ NO | ❌ NO |
| `demo_trade_idempotency` | **0** | ❌ NO | ❌ NO |

### Schema: `vault`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `secrets` | **0** | ❌ NO | ❌ NO |

### Schema: `wallet`

| Table Name | Row Count | RLS Enabled | RLS Forced |
|------------|-----------|-------------|------------|
| `demo_wallet_reset_events` | **0** | ❌ NO | ❌ NO |
| `ledger_entries` | **3** | ❌ NO | ❌ NO |
| `wallet_version_log` | **0** | ❌ NO | ❌ NO |
| `wallets` | **3** | ❌ NO | ❌ NO |

---

## §3 Registered Users (`app_auth.users`)

Total registered users in `app_auth.users`: **8**

Columns present: `id, email, phone, password_hash, display_name, is_verified, is_active, kyc_status, self_exclusion_until, last_login_at, deleted_at, created_at, status, mfa_enabled, mfa_type, referral_code, referred_by_id, failed_login_attempts, locked_until, updated_at, avatar_url`

| # | User ID | Email | Role/Type | Status | Confirmed/Verified | Created At |
|---|---------|-------|-----------|--------|--------------------|------------|
| 1 | `9bde8491-cd19-4b3a-b807-303c99854142` | `just1abacha@gmail.com` | `N/A` | `active` | N/A | 2026-10-05T20:09:53.061Z |
| 2 | `18453f41-c5d8-4667-aa4d-e801a929df3b` | `compliance@skiespro.internal` | `N/A` | `active` | N/A | 2026-10-05T19:18:21.393Z |
| 3 | `b67821d5-087c-4ba3-a987-2ce9c861311c` | `risk@skiespro.internal` | `N/A` | `active` | N/A | 2026-10-05T19:17:58.379Z |
| 4 | `de3646eb-6249-4472-b7dd-bef013c56de6` | `finance@skiespro.internal` | `N/A` | `active` | N/A | 2026-10-05T19:17:46.056Z |
| 5 | `0b17c1b8-8b95-4ba8-909a-fe19a964208b` | `support@skiespro.internal` | `N/A` | `active` | N/A | 2026-10-05T19:17:19.475Z |
| 6 | `c5403482-333e-47fd-91ce-92f1384802ab` | `admin@skiespro.internal` | `N/A` | `active` | N/A | 2026-10-05T19:17:04.931Z |
| 7 | `87d63bfc-4488-4a39-8f20-eda46453ebe9` | `itsphestone@gmail.com` | `N/A` | `active` | N/A | 2026-10-05T17:43:48.712Z |
| 8 | `00000000-0000-0000-0000-000000000000` | `system@skiespro.internal` | `N/A` | `active` | N/A | 2026-07-29T14:10:25.534Z |

---

## §4 Foreign Key Dependency Tree & Identity Table References

### §4.1 Incoming & Outgoing FKs Referencing `app_auth.users`

| Direction | Source Table | Source Column | Target Table | Target Column | Constraint Name |
|-----------|--------------|---------------|--------------|---------------|-----------------|
| ➡️ References `app_auth.users` | `app_auth.mfa_tokens` | `user_id` | `app_auth.users` | `id` | `app_auth_mfa_tokens_user_id_fkey` |
| ➡️ References `app_auth.users` | `app_auth.password_history` | `user_id` | `app_auth.users` | `id` | `password_history_user_id_fkey` |
| ➡️ References `app_auth.users` | `app_auth.password_reset_tokens` | `user_id` | `app_auth.users` | `id` | `app_auth_password_reset_tokens_user_id_fkey` |
| ➡️ References `app_auth.users` | `app_auth.sessions` | `user_id` | `app_auth.users` | `id` | `app_auth_sessions_user_id_fkey` |
| ➡️ References `app_auth.users` | `app_auth.user_roles` | `granted_by` | `app_auth.users` | `id` | `user_roles_granted_by_fkey` |
| ➡️ References `app_auth.users` | `app_auth.user_roles` | `user_id` | `app_auth.users` | `id` | `app_auth_user_roles_user_id_fkey` |
| ➡️ References `app_auth.users` | `app_auth.users` | `referred_by_id` | `app_auth.users` | `id` | `users_referred_by_id_fkey` |

### §4.2 Complete Database Foreign Key Relationships

| Source Schema.Table | Source Column | Target Schema.Table | Target Column | Constraint Name |
|---------------------|---------------|---------------------|---------------|-----------------|
| `admin.job_history` | `job_id` | `admin.system_jobs` | `id` | `admin_job_history_job_id_fkey` |
| `app_auth.mfa_tokens` | `user_id` | `app_auth.users` | `id` | `app_auth_mfa_tokens_user_id_fkey` |
| `app_auth.password_history` | `user_id` | `app_auth.users` | `id` | `password_history_user_id_fkey` |
| `app_auth.password_reset_tokens` | `user_id` | `app_auth.users` | `id` | `app_auth_password_reset_tokens_user_id_fkey` |
| `app_auth.role_permissions` | `permission_id` | `app_auth.permissions` | `id` | `app_auth_role_permissions_permission_id_fkey` |
| `app_auth.role_permissions` | `role_id` | `app_auth.roles` | `id` | `app_auth_role_permissions_role_id_fkey` |
| `app_auth.sessions` | `user_id` | `app_auth.users` | `id` | `app_auth_sessions_user_id_fkey` |
| `app_auth.user_roles` | `granted_by` | `app_auth.users` | `id` | `user_roles_granted_by_fkey` |
| `app_auth.user_roles` | `role_id` | `app_auth.roles` | `id` | `app_auth_user_roles_role_id_fkey` |
| `app_auth.user_roles` | `user_id` | `app_auth.users` | `id` | `app_auth_user_roles_user_id_fkey` |
| `app_auth.users` | `referred_by_id` | `app_auth.users` | `id` | `users_referred_by_id_fkey` |
| `notifications.notification_queue` | `notification_id` | `notifications.notifications` | `id` | `notifications_notification_queue_notification_id_fkey` |
| `payments.deposits` | `gateway_id` | `payments.payment_gateways` | `id` | `payments_deposits_gateway_id_fkey` |
| `payments.deposits` | `idempotency_key` | `payments.idempotency_keys` | `key` | `payments_deposits_idempotency_key_fkey` |
| `payments.payment_webhook_logs` | `gateway_id` | `payments.payment_gateways` | `id` | `payments_payment_webhook_logs_gateway_id_fkey` |
| `payments.withdrawals` | `gateway_id` | `payments.payment_gateways` | `id` | `payments_withdrawals_gateway_id_fkey` |
| `payments.withdrawals` | `idempotency_key` | `payments.idempotency_keys` | `key` | `payments_withdrawals_idempotency_key_fkey` |
| `referral.referral_commissions` | `referral_id` | `referral.referrals` | `id` | `referral_referral_commissions_referral_id_fkey` |
| `referral.referrals` | `referral_code` | `referral.referral_codes` | `code` | `referral_referrals_referral_code_fkey` |
| `trading.asset_config` | `asset_symbol` | `trading.assets` | `symbol` | `trading_asset_config_asset_symbol_fkey` |
| `trading.binary_contracts` | `asset_symbol` | `trading.assets` | `symbol` | `trading_binary_contracts_asset_symbol_fkey` |
| `trading.contract_events` | `contract_id` | `trading.binary_contracts` | `id` | `trading_contract_events_contract_id_fkey` |
| `wallet.ledger_entries` | `wallet_id` | `wallet.wallets` | `id` | `wallet_ledger_entries_wallet_id_fkey` |
| `wallet.wallet_version_log` | `wallet_id` | `wallet.wallets` | `id` | `wallet_wallet_version_log_wallet_id_fkey` |

---

## §5 Row Level Security (RLS) Policies

Total Policies Defined: **0**

*No active RLS policies (`pg_policies`) found in custom schemas.*

---

## §6 Sample Data Snapshot Across Core Schemas

### Table: `admin.audit_logs` (Sample Rows: 0)

*Table is empty (0 rows).*

### Table: `admin.admin_actions` (Sample Rows: 0)

*Table is empty (0 rows).*

### Table: `admin.support_tickets` (Sample Rows: 0)

*Table is empty (0 rows).*

### Table: `admin.system_jobs` (Sample Rows: 0)

*Table is empty (0 rows).*

### Table: `wallet.wallets` (Sample Rows: 3)

```json
[
  {
    "id": "2dc025ea-993c-402d-9678-e04ff8867804",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "balance": "100000.0000",
    "locked_balance": "0.0000",
    "currency": "KES",
    "version": 2,
    "created_at": "2026-10-05T19:08:00.967Z",
    "status": "active",
    "updated_at": "2026-10-05T19:08:00.967Z",
    "available_balance": "100000.0000",
    "account_type": "demo"
  },
  {
    "id": "b3cdbc23-fee6-48c6-9b15-f8e18d5f931f",
    "user_id": "9bde8491-cd19-4b3a-b807-303c99854142",
    "balance": "20000.0000",
    "locked_balance": "0.0000",
    "currency": "KES",
    "version": 1,
    "created_at": "2026-10-05T20:09:53.061Z",
    "status": "active",
    "updated_at": "2026-10-05T20:09:53.061Z",
    "available_balance": "20000.0000",
    "account_type": "real"
  },
  {
    "id": "23a7fec2-b2e5-4aad-8bfb-4df5938f515b",
    "user_id": "9bde8491-cd19-4b3a-b807-303c99854142",
    "balance": "10000.0000",
    "locked_balance": "0.0000",
    "currency": "KES",
    "version": 1,
    "created_at": "2026-10-05T20:09:53.061Z",
    "status": "active",
    "updated_at": "2026-10-05T20:09:53.061Z",
    "available_balance": "10000.0000",
    "account_type": "demo"
  }
]
```

### Table: `wallet.ledger_entries` (Sample Rows: 3)

```json
[
  {
    "id": "fb85f064-4185-41ac-b95b-a034d14b2753",
    "transaction_id": "32039eb5-3d48-457d-9c0e-6973beb72785",
    "wallet_id": "2dc025ea-993c-402d-9678-e04ff8867804",
    "entry_type": "credit",
    "amount": "100000.0000",
    "balance_after": "100000.0000",
    "reference_type": "demo_funding",
    "reference_id": null,
    "description": "Initial virtual demo balance",
    "created_at": "2026-10-05T19:08:00.967Z",
    "balance_before": "0.0000"
  },
  {
    "id": "645f2429-a295-4d34-9e0c-e5c6299fbebf",
    "transaction_id": "2acd5acb-1562-4b2e-9d3d-ac5f1248e595",
    "wallet_id": "b3cdbc23-fee6-48c6-9b15-f8e18d5f931f",
    "entry_type": "credit",
    "amount": "20000.0000",
    "balance_after": "20000.0000",
    "reference_type": "admin_adjustment",
    "reference_id": null,
    "description": "Initial test trader real wallet credit",
    "created_at": "2026-10-05T20:09:53.061Z",
    "balance_before": null
  },
  {
    "id": "134c0e27-2e02-4640-a3da-a9128aabb360",
    "transaction_id": "3943510f-5f25-4493-8581-b61c835deaa2",
    "wallet_id": "23a7fec2-b2e5-4aad-8bfb-4df5938f515b",
    "entry_type": "credit",
    "amount": "10000.0000",
    "balance_after": "10000.0000",
    "reference_type": "demo_funding",
    "reference_id": null,
    "description": "Initial test trader demo wallet credit",
    "created_at": "2026-10-05T20:09:53.061Z",
    "balance_before": null
  }
]
```

### Table: `compliance.kyc_documents` (Sample Rows: 0)

*Table is empty (0 rows).*

### Table: `payments.deposits` (Sample Rows: 0)

*Table is empty (0 rows).*

### Table: `payments.withdrawals` (Sample Rows: 0)

*Table is empty (0 rows).*

### Table: `auth.identities` (Sample Rows: 5)

```json
[
  {
    "provider_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "identity_data": {
      "sub": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
      "email": "its.phestone@gmail.com",
      "email_verified": false,
      "phone_verified": false
    },
    "provider": "email",
    "last_sign_in_at": "2026-10-05T18:29:29.126Z",
    "created_at": "2026-10-05T18:29:29.126Z",
    "updated_at": "2026-10-05T18:29:29.126Z",
    "email": "its.phestone@gmail.com",
    "id": "2f4df1dc-ff87-4d77-b6bb-a7e66a2c4575"
  },
  {
    "provider_id": "c5403482-333e-47fd-91ce-92f1384802ab",
    "user_id": "c5403482-333e-47fd-91ce-92f1384802ab",
    "identity_data": {
      "sub": "c5403482-333e-47fd-91ce-92f1384802ab",
      "email": "admin@skiespro.internal",
      "email_verified": false,
      "phone_verified": false
    },
    "provider": "email",
    "last_sign_in_at": "2026-10-05T19:17:04.659Z",
    "created_at": "2026-10-05T19:17:04.659Z",
    "updated_at": "2026-10-05T19:17:04.659Z",
    "email": "admin@skiespro.internal",
    "id": "db07e65e-b0e4-4923-ad59-622275f4197c"
  },
  {
    "provider_id": "0b17c1b8-8b95-4ba8-909a-fe19a964208b",
    "user_id": "0b17c1b8-8b95-4ba8-909a-fe19a964208b",
    "identity_data": {
      "sub": "0b17c1b8-8b95-4ba8-909a-fe19a964208b",
      "email": "support@skiespro.internal",
      "email_verified": false,
      "phone_verified": false
    },
    "provider": "email",
    "last_sign_in_at": "2026-10-05T19:17:19.215Z",
    "created_at": "2026-10-05T19:17:19.215Z",
    "updated_at": "2026-10-05T19:17:19.215Z",
    "email": "support@skiespro.internal",
    "id": "6eb521ac-c270-4c1c-8245-408505bb85bd"
  },
  {
    "provider_id": "de3646eb-6249-4472-b7dd-bef013c56de6",
    "user_id": "de3646eb-6249-4472-b7dd-bef013c56de6",
    "identity_data": {
      "sub": "de3646eb-6249-4472-b7dd-bef013c56de6",
      "email": "finance@skiespro.internal",
      "email_verified": false,
      "phone_verified": false
    },
    "provider": "email",
    "last_sign_in_at": "2026-10-05T19:17:45.800Z",
    "created_at": "2026-10-05T19:17:45.800Z",
    "updated_at": "2026-10-05T19:17:45.800Z",
    "email": "finance@skiespro.internal",
    "id": "94556f26-0185-40cc-8d28-75db3df5786b"
  },
  {
    "provider_id": "b67821d5-087c-4ba3-a987-2ce9c861311c",
    "user_id": "b67821d5-087c-4ba3-a987-2ce9c861311c",
    "identity_data": {
      "sub": "b67821d5-087c-4ba3-a987-2ce9c861311c",
      "email": "risk@skiespro.internal",
      "email_verified": false,
      "phone_verified": false
    },
    "provider": "email",
    "last_sign_in_at": "2026-10-05T19:17:58.134Z",
    "created_at": "2026-10-05T19:17:58.134Z",
    "updated_at": "2026-10-05T19:17:58.134Z",
    "email": "risk@skiespro.internal",
    "id": "429c09be-5d8b-463f-8625-f391543379d5"
  }
]
```

### Table: `auth.mfa_amr_claims` (Sample Rows: 4)

```json
[
  {
    "session_id": "d31618e2-9936-4ebe-8ca5-2251a4881d6a",
    "created_at": "2026-10-05T18:29:47.381Z",
    "updated_at": "2026-10-05T18:29:47.381Z",
    "authentication_method": "password",
    "id": "a1dbea2d-7265-46aa-abf8-adae82bcc481"
  },
  {
    "session_id": "4a7fa679-59ce-4ee2-9d34-da49e2e69f39",
    "created_at": "2026-10-05T18:46:18.390Z",
    "updated_at": "2026-10-05T18:46:18.390Z",
    "authentication_method": "password",
    "id": "e89ad86b-dcf9-4d03-a095-6988b681e034"
  },
  {
    "session_id": "7cff893a-4b62-4c47-bef4-c112593cc717",
    "created_at": "2026-10-05T18:47:07.118Z",
    "updated_at": "2026-10-05T18:47:07.118Z",
    "authentication_method": "password",
    "id": "0db9f0e6-19c9-4e00-85aa-c490855cd902"
  },
  {
    "session_id": "f4c6abe9-268b-4c7a-a0c8-6ff9c02ce992",
    "created_at": "2026-10-05T18:47:53.832Z",
    "updated_at": "2026-10-05T18:47:53.832Z",
    "authentication_method": "password",
    "id": "bbf9ec1a-1531-46bf-bb8d-b37c377917de"
  }
]
```

### Table: `auth.refresh_tokens` (Sample Rows: 4)

```json
[
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "2",
    "token": "zo4hg4ds2nvs",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "revoked": false,
    "created_at": "2026-10-05T18:29:47.380Z",
    "updated_at": "2026-10-05T18:29:47.380Z",
    "parent": null,
    "session_id": "d31618e2-9936-4ebe-8ca5-2251a4881d6a"
  },
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "3",
    "token": "podkndb5p6pu",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "revoked": false,
    "created_at": "2026-10-05T18:46:18.363Z",
    "updated_at": "2026-10-05T18:46:18.363Z",
    "parent": null,
    "session_id": "4a7fa679-59ce-4ee2-9d34-da49e2e69f39"
  },
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "4",
    "token": "v5wqtddtrm2y",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "revoked": false,
    "created_at": "2026-10-05T18:47:07.117Z",
    "updated_at": "2026-10-05T18:47:07.117Z",
    "parent": null,
    "session_id": "7cff893a-4b62-4c47-bef4-c112593cc717"
  },
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "5",
    "token": "qc2mmweqyinw",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "revoked": false,
    "created_at": "2026-10-05T18:47:53.827Z",
    "updated_at": "2026-10-05T18:47:53.827Z",
    "parent": null,
    "session_id": "f4c6abe9-268b-4c7a-a0c8-6ff9c02ce992"
  }
]
```

### Table: `auth.schema_migrations` (Sample Rows: 5)

```json
[
  {
    "version": "20171026211738"
  },
  {
    "version": "20171026211808"
  },
  {
    "version": "20171026211834"
  },
  {
    "version": "20180103212743"
  },
  {
    "version": "20180108183307"
  }
]
```

### Table: `auth.sessions` (Sample Rows: 4)

```json
[
  {
    "id": "d31618e2-9936-4ebe-8ca5-2251a4881d6a",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "created_at": "2026-10-05T18:29:47.371Z",
    "updated_at": "2026-10-05T18:29:47.371Z",
    "factor_id": null,
    "aal": "aal1",
    "not_after": null,
    "refreshed_at": null,
    "user_agent": "node",
    "ip": "102.210.28.232",
    "tag": null,
    "oauth_client_id": null,
    "refresh_token_hmac_key": null,
    "refresh_token_counter": null,
    "scopes": null
  },
  {
    "id": "4a7fa679-59ce-4ee2-9d34-da49e2e69f39",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "created_at": "2026-10-05T18:46:18.332Z",
    "updated_at": "2026-10-05T18:46:18.332Z",
    "factor_id": null,
    "aal": "aal1",
    "not_after": null,
    "refreshed_at": null,
    "user_agent": "node",
    "ip": "102.210.28.232",
    "tag": null,
    "oauth_client_id": null,
    "refresh_token_hmac_key": null,
    "refresh_token_counter": null,
    "scopes": null
  },
  {
    "id": "7cff893a-4b62-4c47-bef4-c112593cc717",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "created_at": "2026-10-05T18:47:07.115Z",
    "updated_at": "2026-10-05T18:47:07.115Z",
    "factor_id": null,
    "aal": "aal1",
    "not_after": null,
    "refreshed_at": null,
    "user_agent": "node",
    "ip": "102.210.28.232",
    "tag": null,
    "oauth_client_id": null,
    "refresh_token_hmac_key": null,
    "refresh_token_counter": null,
    "scopes": null
  },
  {
    "id": "f4c6abe9-268b-4c7a-a0c8-6ff9c02ce992",
    "user_id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "created_at": "2026-10-05T18:47:53.820Z",
    "updated_at": "2026-10-05T18:47:53.820Z",
    "factor_id": null,
    "aal": "aal1",
    "not_after": null,
    "refreshed_at": null,
    "user_agent": "node",
    "ip": "102.210.28.232",
    "tag": null,
    "oauth_client_id": null,
    "refresh_token_hmac_key": null,
    "refresh_token_counter": null,
    "scopes": null
  }
]
```

### Table: `auth.users` (Sample Rows: 5)

```json
[
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "87d63bfc-4488-4a39-8f20-eda46453ebe9",
    "aud": "authenticated",
    "role": "authenticated",
    "email": "its.phestone@gmail.com",
    "encrypted_password": "$2a$10$0i3/oEjNpnaKvICNzJqJiOaz7a4fvNDpmtYb9Q51xPZLmySyaQ3gO",
    "email_confirmed_at": "2026-10-05T18:29:44.722Z",
    "invited_at": null,
    "confirmation_token": "",
    "confirmation_sent_at": null,
    "recovery_token": "",
    "recovery_sent_at": null,
    "email_change_token_new": "",
    "email_change": "",
    "email_change_sent_at": null,
    "last_sign_in_at": "2026-10-05T18:47:53.820Z",
    "raw_app_meta_data": {
      "provider": "email",
      "providers": [
        "email"
      ]
    },
    "raw_user_meta_data": {
      "role": "super_admin",
      "phone": "708671172",
      "display_name": "Phesty Ryan",
      "email_verified": true
    },
    "is_super_admin": null,
    "created_at": "2026-10-05T18:29:29.106Z",
    "updated_at": "2026-10-05T18:47:53.832Z",
    "phone": null,
    "phone_confirmed_at": null,
    "phone_change": "",
    "phone_change_token": "",
    "phone_change_sent_at": null,
    "confirmed_at": "2026-10-05T18:29:44.722Z",
    "email_change_token_current": "",
    "email_change_confirm_status": 0,
    "banned_until": null,
    "reauthentication_token": "",
    "reauthentication_sent_at": null,
    "is_sso_user": false,
    "deleted_at": null,
    "is_anonymous": false
  },
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "b67821d5-087c-4ba3-a987-2ce9c861311c",
    "aud": "authenticated",
    "role": "authenticated",
    "email": "risk@skiespro.internal",
    "encrypted_password": "$2a$10$0Xz5H1T0D6DIHkxr8Xl.EOZGK/f2CLLSEFvO9PXcmOkK8uqt/g5gS",
    "email_confirmed_at": "2026-10-05T19:28:03.578Z",
    "invited_at": null,
    "confirmation_token": "",
    "confirmation_sent_at": null,
    "recovery_token": "",
    "recovery_sent_at": null,
    "email_change_token_new": "",
    "email_change": "",
    "email_change_sent_at": null,
    "last_sign_in_at": null,
    "raw_app_meta_data": {
      "provider": "email",
      "providers": [
        "email"
      ]
    },
    "raw_user_meta_data": {
      "role": "risk_manager",
      "phone": "+254700000004",
      "display_name": "SkiesPro Risk Manager",
      "email_verified": true
    },
    "is_super_admin": null,
    "created_at": "2026-10-05T19:17:58.133Z",
    "updated_at": "2026-10-05T19:28:03.581Z",
    "phone": null,
    "phone_confirmed_at": null,
    "phone_change": "",
    "phone_change_token": "",
    "phone_change_sent_at": null,
    "confirmed_at": "2026-10-05T19:28:03.578Z",
    "email_change_token_current": "",
    "email_change_confirm_status": 0,
    "banned_until": null,
    "reauthentication_token": "",
    "reauthentication_sent_at": null,
    "is_sso_user": false,
    "deleted_at": null,
    "is_anonymous": false
  },
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "c5403482-333e-47fd-91ce-92f1384802ab",
    "aud": "authenticated",
    "role": "authenticated",
    "email": "admin@skiespro.internal",
    "encrypted_password": "$2a$10$EtgpIrglTOqnwlYVRCs4WOZUKwGmHeIzJpfHO/xdJMdrJvNmsktr.",
    "email_confirmed_at": "2026-10-05T19:26:55.589Z",
    "invited_at": null,
    "confirmation_token": "",
    "confirmation_sent_at": null,
    "recovery_token": "",
    "recovery_sent_at": null,
    "email_change_token_new": "",
    "email_change": "",
    "email_change_sent_at": null,
    "last_sign_in_at": null,
    "raw_app_meta_data": {
      "provider": "email",
      "providers": [
        "email"
      ]
    },
    "raw_user_meta_data": {
      "role": "admin",
      "phone": "+254700000001",
      "display_name": "SkiesPro Admin",
      "email_verified": true
    },
    "is_super_admin": null,
    "created_at": "2026-10-05T19:17:04.637Z",
    "updated_at": "2026-10-05T19:26:55.594Z",
    "phone": null,
    "phone_confirmed_at": null,
    "phone_change": "",
    "phone_change_token": "",
    "phone_change_sent_at": null,
    "confirmed_at": "2026-10-05T19:26:55.589Z",
    "email_change_token_current": "",
    "email_change_confirm_status": 0,
    "banned_until": null,
    "reauthentication_token": "",
    "reauthentication_sent_at": null,
    "is_sso_user": false,
    "deleted_at": null,
    "is_anonymous": false
  },
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "18453f41-c5d8-4667-aa4d-e801a929df3b",
    "aud": "authenticated",
    "role": "authenticated",
    "email": "compliance@skiespro.internal",
    "encrypted_password": "$2a$10$PvWE9OWJLm9TNIkUte9po.vWWIp5wZh/WiDFooOjHA/4/1yrsMHEK",
    "email_confirmed_at": "2026-10-05T19:28:22.785Z",
    "invited_at": null,
    "confirmation_token": "",
    "confirmation_sent_at": null,
    "recovery_token": "",
    "recovery_sent_at": null,
    "email_change_token_new": "",
    "email_change": "",
    "email_change_sent_at": null,
    "last_sign_in_at": null,
    "raw_app_meta_data": {
      "provider": "email",
      "providers": [
        "email"
      ]
    },
    "raw_user_meta_data": {
      "role": "compliance",
      "phone": "+254700000005",
      "display_name": "SkiesPro Compliance",
      "email_verified": true
    },
    "is_super_admin": null,
    "created_at": "2026-10-05T19:18:21.139Z",
    "updated_at": "2026-10-05T19:28:22.787Z",
    "phone": null,
    "phone_confirmed_at": null,
    "phone_change": "",
    "phone_change_token": "",
    "phone_change_sent_at": null,
    "confirmed_at": "2026-10-05T19:28:22.785Z",
    "email_change_token_current": "",
    "email_change_confirm_status": 0,
    "banned_until": null,
    "reauthentication_token": "",
    "reauthentication_sent_at": null,
    "is_sso_user": false,
    "deleted_at": null,
    "is_anonymous": false
  },
  {
    "instance_id": "00000000-0000-0000-0000-000000000000",
    "id": "0b17c1b8-8b95-4ba8-909a-fe19a964208b",
    "aud": "authenticated",
    "role": "authenticated",
    "email": "support@skiespro.internal",
    "encrypted_password": "$2a$10$7MgC9QNJNGvaQyTo//jLdeGs.cAzzQShpAtiUCVvaXQUenyO9PDhO",
    "email_confirmed_at": "2026-10-05T19:27:34.767Z",
    "invited_at": null,
    "confirmation_token": "",
    "confirmation_sent_at": null,
    "recovery_token": "",
    "recovery_sent_at": null,
    "email_change_token_new": "",
    "email_change": "",
    "email_change_sent_at": null,
    "last_sign_in_at": null,
    "raw_app_meta_data": {
      "provider": "email",
      "providers": [
        "email"
      ]
    },
    "raw_user_meta_data": {
      "role": "support",
      "phone": "+254700000002",
      "display_name": "SkiesPro Support",
      "email_verified": true
    },
    "is_super_admin": null,
    "created_at": "2026-10-05T19:17:19.212Z",
    "updated_at": "2026-10-05T19:27:34.769Z",
    "phone": null,
    "phone_confirmed_at": null,
    "phone_change": "",
    "phone_change_token": "",
    "phone_change_sent_at": null,
    "confirmed_at": "2026-10-05T19:27:34.767Z",
    "email_change_token_current": "",
    "email_change_confirm_status": 0,
    "banned_until": null,
    "reauthentication_token": "",
    "reauthentication_sent_at": null,
    "is_sso_user": false,
    "deleted_at": null,
    "is_anonymous": false
  }
]
```

### Table: `config.feature_flags` (Sample Rows: 5)

```json
[
  {
    "flag_name": "registration_enabled",
    "is_enabled": true,
    "description": "Allow new user registrations",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  },
  {
    "flag_name": "trading_enabled",
    "is_enabled": true,
    "description": "Allow trading operations",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  },
  {
    "flag_name": "deposits_enabled",
    "is_enabled": true,
    "description": "Allow deposit operations",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  },
  {
    "flag_name": "withdrawals_enabled",
    "is_enabled": true,
    "description": "Allow withdrawal operations",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  },
  {
    "flag_name": "referrals_enabled",
    "is_enabled": true,
    "description": "Enable referral system",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  }
]
```

### Table: `config.platform_settings` (Sample Rows: 5)

```json
[
  {
    "key": "platform.currency",
    "value": "KES",
    "description": "Base currency for the platform",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  },
  {
    "key": "deposit.min_amount",
    "value": 500,
    "description": "Minimum deposit amount in KES",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  },
  {
    "key": "withdrawal.min_amount",
    "value": 500,
    "description": "Minimum withdrawal amount in KES",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  },
  {
    "key": "trade.max_duration_seconds",
    "value": 3600,
    "description": "Maximum trade duration in seconds",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  },
  {
    "key": "kyc.required_for_trading",
    "value": false,
    "description": "Whether KYC is required before trading",
    "updated_by": "00000000-0000-0000-0000-000000000000",
    "updated_at": "2026-08-01T10:18:39.321Z"
  }
]
```

### Table: `events.event_outbox` (Sample Rows: 1)

```json
[
  {
    "id": "1322",
    "event_type": "UserRegisteredEvent",
    "aggregate_type": "User",
    "aggregate_id": "57754967-d0f9-467a-9874-1b4f8cd043f7",
    "payload": {
      "email": "itsphestone@gmail.com",
      "userId": "57754967-d0f9-467a-9874-1b4f8cd043f7",
      "currency": "KES",
      "displayName": "Phestone Ryan"
    },
    "published": false,
    "published_at": null,
    "retry_count": 0,
    "last_error": null,
    "created_at": "2026-10-05T18:35:18.474Z"
  }
]
```

### Table: `payments.payment_gateways` (Sample Rows: 1)

```json
[
  {
    "id": 1,
    "name": "M-Pesa",
    "provider_type": "mobile_money",
    "is_active": true,
    "config": {
      "passkey": "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
      "shortcode": "174379",
      "environment": "sandbox",
      "callback_url": "https://skiespro-api-njuw.onrender.com/api/v1/payments/deposit/callback?token=f6e4b18b4a861c04bab8951d8c9faf9cafbfc1ef600c6894c43e407420b3ed66",
      "consumer_key": "bb5EgSPAvE3j74l6HkUTAoxUkVOk4qap0u2adqLtRqRxDNfZ",
      "initiator_name": "testapi",
      "consumer_secret": "tADx76Cq2B8nkM3OAAE9sz8wyJXZBGaDN6VRhb4ezB1LGou04jDOKHzvSYaT2t8O",
      "security_credential": "SandboxSecurityCredential"
    },
    "created_at": "2026-07-29T13:42:47.853Z"
  }
]
```

### Table: `pricing.candles` (Sample Rows: 5)

```json
[
  {
    "id": "2602",
    "symbol": "USD/JPY",
    "granularity_seconds": 60,
    "open_time": "2026-08-28T10:49:00.000Z",
    "close_time": "2026-08-28T10:49:59.999Z",
    "open_price": "150.513880",
    "high_price": "150.513880",
    "low_price": "150.264200",
    "close_price": "150.295560",
    "volume": "0",
    "created_at": "2026-08-28T10:50:00.998Z",
    "tick_count": null,
    "source": "legacy"
  },
  {
    "id": "86",
    "symbol": "WTI/USD",
    "granularity_seconds": 60,
    "open_time": "2026-08-20T15:00:00.000Z",
    "close_time": "2026-08-20T15:00:59.999Z",
    "open_price": "1.000655",
    "high_price": "1.000655",
    "low_price": "1.000655",
    "close_price": "1.000655",
    "volume": "0",
    "created_at": "2026-08-20T15:00:53.936Z",
    "tick_count": null,
    "source": "legacy"
  },
  {
    "id": "399",
    "symbol": "BTC/USD",
    "granularity_seconds": 60,
    "open_time": "2026-08-20T15:11:00.000Z",
    "close_time": "2026-08-20T15:11:59.999Z",
    "open_price": "72208.925000",
    "high_price": "72243.995000",
    "low_price": "72148.005000",
    "close_price": "72243.995000",
    "volume": "0",
    "created_at": "2026-08-20T15:11:52.773Z",
    "tick_count": null,
    "source": "legacy"
  },
  {
    "id": "44",
    "symbol": "EUR/USD",
    "granularity_seconds": 60,
    "open_time": "2026-08-20T15:00:00.000Z",
    "close_time": "2026-08-20T15:00:59.999Z",
    "open_price": "1.169000",
    "high_price": "1.169000",
    "low_price": "1.168850",
    "close_price": "1.168850",
    "volume": "0",
    "created_at": "2026-08-20T15:00:53.373Z",
    "tick_count": null,
    "source": "legacy"
  },
  {
    "id": "161",
    "symbol": "WTI/USD",
    "granularity_seconds": 60,
    "open_time": "2026-08-20T15:02:00.000Z",
    "close_time": "2026-08-20T15:02:59.999Z",
    "open_price": "1.000655",
    "high_price": "1.000655",
    "low_price": "1.000655",
    "close_price": "1.000655",
    "volume": "0",
    "created_at": "2026-08-20T15:02:53.803Z",
    "tick_count": null,
    "source": "legacy"
  }
]
```

### Table: `pricing.market_hours` (Sample Rows: 5)

```json
[
  {
    "asset_symbol": "EUR/USD",
    "opens_at": "00:00:00",
    "closes_at": "23:59:59",
    "timezone": "UTC",
    "is_24_7": true
  },
  {
    "asset_symbol": "GBP/USD",
    "opens_at": "00:00:00",
    "closes_at": "23:59:59",
    "timezone": "UTC",
    "is_24_7": true
  },
  {
    "asset_symbol": "USD/JPY",
    "opens_at": "00:00:00",
    "closes_at": "23:59:59",
    "timezone": "UTC",
    "is_24_7": true
  },
  {
    "asset_symbol": "XAU/USD",
    "opens_at": "01:00:00",
    "closes_at": "23:59:59",
    "timezone": "UTC",
    "is_24_7": false
  },
  {
    "asset_symbol": "WTI/USD",
    "opens_at": "01:00:00",
    "closes_at": "23:59:59",
    "timezone": "UTC",
    "is_24_7": false
  }
]
```

### Table: `pricing.price_ticks` (Sample Rows: 5)

```json
[
  {
    "id": "1712167",
    "symbol": "GBP/USD",
    "tick_time": "2026-10-05T17:26:23.792Z",
    "bid_price": "1.267630",
    "ask_price": "1.268160",
    "mid_price": "1.267895",
    "volume": "0",
    "created_at": "2026-10-05T17:26:24.510Z",
    "source": "demo"
  },
  {
    "id": "1712168",
    "symbol": "XAU/USD",
    "tick_time": "2026-10-05T17:26:23.799Z",
    "bid_price": "2021.410000",
    "ask_price": "2022.140000",
    "mid_price": "2021.775000",
    "volume": "0",
    "created_at": "2026-10-05T17:26:24.510Z",
    "source": "demo"
  },
  {
    "id": "1712169",
    "symbol": "GBP/USD",
    "tick_time": "2026-10-05T17:26:24.095Z",
    "bid_price": "1.267590",
    "ask_price": "1.268180",
    "mid_price": "1.267885",
    "volume": "0",
    "created_at": "2026-10-05T17:26:24.510Z",
    "source": "demo"
  },
  {
    "id": "1712170",
    "symbol": "XAU/USD",
    "tick_time": "2026-10-05T17:26:24.181Z",
    "bid_price": "2021.040000",
    "ask_price": "2021.870000",
    "mid_price": "2021.455000",
    "volume": "0",
    "created_at": "2026-10-05T17:26:24.510Z",
    "source": "demo"
  },
  {
    "id": "1712171",
    "symbol": "WTI/USD",
    "tick_time": "2026-10-05T17:26:24.407Z",
    "bid_price": "77.811000",
    "ask_price": "77.878000",
    "mid_price": "77.844500",
    "volume": "0",
    "created_at": "2026-10-05T17:26:24.510Z",
    "source": "demo"
  }
]
```

### Table: `realtime.schema_migrations` (Sample Rows: 5)

```json
[
  {
    "version": "20211116024918",
    "inserted_at": "2026-07-29T06:43:11.000Z"
  },
  {
    "version": "20211116045059",
    "inserted_at": "2026-07-29T06:43:11.000Z"
  },
  {
    "version": "20211116050929",
    "inserted_at": "2026-07-29T06:43:11.000Z"
  },
  {
    "version": "20211116051442",
    "inserted_at": "2026-07-29T06:43:11.000Z"
  },
  {
    "version": "20211116212300",
    "inserted_at": "2026-07-29T06:43:11.000Z"
  }
]
```

### Table: `storage.buckets` (Sample Rows: 1)

```json
[
  {
    "id": "avatars",
    "name": "avatars",
    "owner": null,
    "created_at": "2026-08-08T20:39:14.901Z",
    "updated_at": "2026-08-08T20:39:14.901Z",
    "public": true,
    "avif_autodetection": false,
    "file_size_limit": "2097152",
    "allowed_mime_types": null,
    "owner_id": null,
    "type": "STANDARD",
    "versioning_status": "DISABLED",
    "lifecycle_configuration": null,
    "lifecycle_configuration_generation": null
  }
]
```

### Table: `storage.migrations` (Sample Rows: 5)

```json
[
  {
    "id": 0,
    "name": "create-migrations-table",
    "hash": "e18db593bcde2aca2a408c4d1100f6abba2195df",
    "executed_at": "2026-07-29T06:43:53.726Z"
  },
  {
    "id": 1,
    "name": "initialmigration",
    "hash": "6ab16121fbaa08bbd11b712d05f358f9b555d777",
    "executed_at": "2026-07-29T06:43:53.768Z"
  },
  {
    "id": 2,
    "name": "storage-schema",
    "hash": "f6a1fa2c93cbcd16d4e487b362e45fca157a8dbd",
    "executed_at": "2026-07-29T06:43:53.772Z"
  },
  {
    "id": 3,
    "name": "pathtoken-column",
    "hash": "2cb1b0004b817b29d5b0a971af16bafeede4b70d",
    "executed_at": "2026-07-29T06:43:53.800Z"
  },
  {
    "id": 4,
    "name": "add-migrations-rls",
    "hash": "427c5b63fe1c5937495d9c635c263ee7a5905058",
    "executed_at": "2026-07-29T06:43:53.815Z"
  }
]
```

### Table: `trading.asset_config` (Sample Rows: 5)

```json
[
  {
    "id": "2fc31383-7039-437e-b9c4-9c8f95383ce8",
    "asset_symbol": "EUR/USD",
    "min_stake": "100.0000",
    "max_stake_per_trade": "50000.0000",
    "min_duration_seconds": 30,
    "max_duration_seconds": 3600,
    "payout_rate": "0.60",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "max_exposure": "1000000.00",
    "volatility_multiplier": null,
    "updated_by": null,
    "valid_from": null,
    "valid_until": null
  },
  {
    "id": "f938ac45-4394-4ab1-ab32-d4ffef4a4374",
    "asset_symbol": "GBP/USD",
    "min_stake": "500.0000",
    "max_stake_per_trade": "500000.0000",
    "min_duration_seconds": 30,
    "max_duration_seconds": 3600,
    "payout_rate": "0.60",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "max_exposure": null,
    "volatility_multiplier": null,
    "updated_by": null,
    "valid_from": null,
    "valid_until": null
  },
  {
    "id": "03805df1-a4c6-4ac5-8577-608a3534072e",
    "asset_symbol": "USD/JPY",
    "min_stake": "500.0000",
    "max_stake_per_trade": "500000.0000",
    "min_duration_seconds": 30,
    "max_duration_seconds": 3600,
    "payout_rate": "0.60",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "max_exposure": null,
    "volatility_multiplier": null,
    "updated_by": null,
    "valid_from": null,
    "valid_until": null
  },
  {
    "id": "c296ace8-f074-4894-86cc-c064409fdfe4",
    "asset_symbol": "XAU/USD",
    "min_stake": "500.0000",
    "max_stake_per_trade": "500000.0000",
    "min_duration_seconds": 30,
    "max_duration_seconds": 3600,
    "payout_rate": "0.60",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "max_exposure": null,
    "volatility_multiplier": null,
    "updated_by": null,
    "valid_from": null,
    "valid_until": null
  },
  {
    "id": "9017a51b-4c70-4dd5-bb06-bd3c07db085c",
    "asset_symbol": "WTI/USD",
    "min_stake": "500.0000",
    "max_stake_per_trade": "500000.0000",
    "min_duration_seconds": 30,
    "max_duration_seconds": 3600,
    "payout_rate": "0.60",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "max_exposure": null,
    "volatility_multiplier": null,
    "updated_by": null,
    "valid_from": null,
    "valid_until": null
  }
]
```

### Table: `trading.assets` (Sample Rows: 5)

```json
[
  {
    "symbol": "EUR/USD",
    "name": "Euro/US Dollar",
    "asset_type": "forex",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "min_stake": "1.0000",
    "max_stake": "500.0000",
    "min_expiry_seconds": 60,
    "max_expiry_seconds": 86400,
    "pip_decimal_places": 5
  },
  {
    "symbol": "GBP/USD",
    "name": "British Pound/US Dollar",
    "asset_type": "forex",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "min_stake": "1.0000",
    "max_stake": "500.0000",
    "min_expiry_seconds": 60,
    "max_expiry_seconds": 86400,
    "pip_decimal_places": 5
  },
  {
    "symbol": "USD/JPY",
    "name": "US Dollar/Japanese Yen",
    "asset_type": "forex",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "min_stake": "1.0000",
    "max_stake": "500.0000",
    "min_expiry_seconds": 60,
    "max_expiry_seconds": 86400,
    "pip_decimal_places": 5
  },
  {
    "symbol": "XAU/USD",
    "name": "Gold",
    "asset_type": "commodity",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "min_stake": "1.0000",
    "max_stake": "500.0000",
    "min_expiry_seconds": 60,
    "max_expiry_seconds": 86400,
    "pip_decimal_places": 5
  },
  {
    "symbol": "WTI/USD",
    "name": "Crude Oil",
    "asset_type": "commodity",
    "is_active": true,
    "created_at": "2026-07-29T13:41:55.098Z",
    "min_stake": "1.0000",
    "max_stake": "500.0000",
    "min_expiry_seconds": 60,
    "max_expiry_seconds": 86400,
    "pip_decimal_places": 5
  }
]
```

---

## §7 Detailed Column Inventory

<details>
<summary><b>Schema: admin Columns Detail</b></summary>

#### Table: `admin.admin_actions`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `admin_id` | `uuid` | NO | `NULL` |
| `action_type` | `character varying` | NO | `NULL` |
| `target_user_id` | `uuid` | YES | `NULL` |
| `details` | `jsonb` | NO | `NULL` |
| `requires_approval` | `boolean` | NO | `true` |
| `approved_by` | `uuid` | YES | `NULL` |
| `approved_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `admin.audit_logs`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('admin.audit_logs_id_seq'::regclass)` |
| `entry_hash` | `character varying` | NO | `NULL` |
| `previous_entry_hash` | `character varying` | NO | `NULL` |
| `actor_id` | `uuid` | YES | `NULL` |
| `action` | `character varying` | NO | `NULL` |
| `affected_entity` | `character varying` | NO | `NULL` |
| `entity_id` | `uuid` | YES | `NULL` |
| `details` | `jsonb` | NO | `'{}'::jsonb` |
| `ip_address` | `inet` | YES | `NULL` |
| `user_agent` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `admin.job_history`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('admin.job_history_id_seq'::regclass)` |
| `job_id` | `uuid` | NO | `NULL` |
| `status` | `character varying` | NO | `NULL` |
| `message` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `admin.support_tickets`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `subject` | `character varying` | NO | `NULL` |
| `status` | `character varying` | NO | `'open'::character varying` |
| `priority` | `character varying` | NO | `'normal'::character varying` |
| `assigned_to` | `uuid` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `resolved_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `admin.system_jobs`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `job_type` | `character varying` | NO | `NULL` |
| `status` | `character varying` | NO | `'pending'::character varying` |
| `started_at` | `timestamp with time zone` | YES | `NULL` |
| `completed_at` | `timestamp with time zone` | YES | `NULL` |
| `result` | `jsonb` | YES | `NULL` |
| `error_message` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: app_auth Columns Detail</b></summary>

#### Table: `app_auth.mfa_tokens`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `secret_encrypted` | `character varying` | NO | `NULL` |
| `is_enabled` | `boolean` | NO | `false` |
| `backup_codes` | `ARRAY` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `verified_at` | `timestamp with time zone` | YES | `NULL` |
| `enabled_at` | `timestamp with time zone` | YES | `NULL` |
| `disabled_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `app_auth.password_history`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('app_auth.password_history_id_seq'::regclass)` |
| `user_id` | `uuid` | NO | `NULL` |
| `password_hash` | `character varying` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `app_auth.password_reset_tokens`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `token_hash` | `character varying` | NO | `NULL` |
| `expires_at` | `timestamp with time zone` | NO | `NULL` |
| `used_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `app_auth.permissions`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `code` | `character varying` | NO | `NULL` |
| `resource` | `character varying` | NO | `NULL` |
| `action` | `character varying` | NO | `NULL` |
| `description` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `app_auth.role_permissions`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `role_id` | `uuid` | NO | `NULL` |
| `permission_id` | `uuid` | NO | `NULL` |
| `granted_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `app_auth.roles`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `name` | `character varying` | NO | `NULL` |
| `description` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `app_auth.sessions`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `token_hash` | `character varying` | NO | `NULL` |
| `ip_address` | `inet` | YES | `NULL` |
| `user_agent` | `text` | YES | `NULL` |
| `expires_at` | `timestamp with time zone` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `access_token_jti` | `character varying` | YES | `NULL` |
| `refresh_token_hash` | `character varying` | YES | `NULL` |
| `refresh_token_expires_at` | `timestamp with time zone` | YES | `NULL` |
| `device_info` | `jsonb` | YES | `NULL` |
| `is_revoked` | `boolean` | NO | `false` |
| `revoked_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `app_auth.user_roles`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `role_id` | `uuid` | NO | `NULL` |
| `granted_at` | `timestamp with time zone` | NO | `now()` |
| `granted_by` | `uuid` | YES | `NULL` |
| `revoked_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `app_auth.users`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `email` | `character varying` | NO | `NULL` |
| `phone` | `character varying` | YES | `NULL` |
| `password_hash` | `character varying` | NO | `NULL` |
| `display_name` | `character varying` | YES | `NULL` |
| `is_verified` | `boolean` | NO | `false` |
| `is_active` | `boolean` | NO | `true` |
| `kyc_status` | `character varying` | NO | `'none'::character varying` |
| `self_exclusion_until` | `timestamp with time zone` | YES | `NULL` |
| `last_login_at` | `timestamp with time zone` | YES | `NULL` |
| `deleted_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `status` | `character varying` | NO | `'active'::character varying` |
| `mfa_enabled` | `boolean` | NO | `false` |
| `mfa_type` | `character varying` | YES | `NULL` |
| `referral_code` | `character varying` | YES | `NULL` |
| `referred_by_id` | `uuid` | YES | `NULL` |
| `failed_login_attempts` | `smallint` | NO | `0` |
| `locked_until` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `avatar_url` | `character varying` | YES | `NULL` |

</details>

<details>
<summary><b>Schema: auth Columns Detail</b></summary>

#### Table: `auth.audit_log_entries`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `instance_id` | `uuid` | YES | `NULL` |
| `id` | `uuid` | NO | `NULL` |
| `payload` | `json` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `ip_address` | `character varying` | NO | `''::character varying` |

#### Table: `auth.custom_oauth_providers`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `provider_type` | `text` | NO | `NULL` |
| `identifier` | `text` | NO | `NULL` |
| `name` | `text` | NO | `NULL` |
| `client_id` | `text` | NO | `NULL` |
| `client_secret` | `text` | NO | `NULL` |
| `acceptable_client_ids` | `ARRAY` | NO | `'{}'::text[]` |
| `scopes` | `ARRAY` | NO | `'{}'::text[]` |
| `pkce_enabled` | `boolean` | NO | `true` |
| `attribute_mapping` | `jsonb` | NO | `'{}'::jsonb` |
| `authorization_params` | `jsonb` | NO | `'{}'::jsonb` |
| `enabled` | `boolean` | NO | `true` |
| `email_optional` | `boolean` | NO | `false` |
| `issuer` | `text` | YES | `NULL` |
| `discovery_url` | `text` | YES | `NULL` |
| `skip_nonce_check` | `boolean` | NO | `false` |
| `cached_discovery` | `jsonb` | YES | `NULL` |
| `discovery_cached_at` | `timestamp with time zone` | YES | `NULL` |
| `authorization_url` | `text` | YES | `NULL` |
| `token_url` | `text` | YES | `NULL` |
| `userinfo_url` | `text` | YES | `NULL` |
| `jwks_uri` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `custom_claims_allowlist` | `ARRAY` | NO | `'{}'::text[]` |

#### Table: `auth.flow_state`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `user_id` | `uuid` | YES | `NULL` |
| `auth_code` | `text` | YES | `NULL` |
| `code_challenge_method` | `USER-DEFINED` | YES | `NULL` |
| `code_challenge` | `text` | YES | `NULL` |
| `provider_type` | `text` | NO | `NULL` |
| `provider_access_token` | `text` | YES | `NULL` |
| `provider_refresh_token` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |
| `authentication_method` | `text` | NO | `NULL` |
| `auth_code_issued_at` | `timestamp with time zone` | YES | `NULL` |
| `invite_token` | `text` | YES | `NULL` |
| `referrer` | `text` | YES | `NULL` |
| `oauth_client_state_id` | `uuid` | YES | `NULL` |
| `linking_target_id` | `uuid` | YES | `NULL` |
| `email_optional` | `boolean` | NO | `false` |

#### Table: `auth.identities`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `provider_id` | `text` | NO | `NULL` |
| `user_id` | `uuid` | NO | `NULL` |
| `identity_data` | `jsonb` | NO | `NULL` |
| `provider` | `text` | NO | `NULL` |
| `last_sign_in_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |
| `email` | `text` | YES | `NULL` |
| `id` | `uuid` | NO | `gen_random_uuid()` |

#### Table: `auth.instances`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `uuid` | `uuid` | YES | `NULL` |
| `raw_base_config` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `auth.mfa_amr_claims`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `session_id` | `uuid` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `NULL` |
| `updated_at` | `timestamp with time zone` | NO | `NULL` |
| `authentication_method` | `text` | NO | `NULL` |
| `id` | `uuid` | NO | `NULL` |

#### Table: `auth.mfa_challenges`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `factor_id` | `uuid` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `NULL` |
| `verified_at` | `timestamp with time zone` | YES | `NULL` |
| `ip_address` | `inet` | NO | `NULL` |
| `otp_code` | `text` | YES | `NULL` |
| `web_authn_session_data` | `jsonb` | YES | `NULL` |

#### Table: `auth.mfa_factors`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `user_id` | `uuid` | NO | `NULL` |
| `friendly_name` | `text` | YES | `NULL` |
| `factor_type` | `USER-DEFINED` | NO | `NULL` |
| `status` | `USER-DEFINED` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `NULL` |
| `updated_at` | `timestamp with time zone` | NO | `NULL` |
| `secret` | `text` | YES | `NULL` |
| `phone` | `text` | YES | `NULL` |
| `last_challenged_at` | `timestamp with time zone` | YES | `NULL` |
| `web_authn_credential` | `jsonb` | YES | `NULL` |
| `web_authn_aaguid` | `uuid` | YES | `NULL` |
| `last_webauthn_challenge_data` | `jsonb` | YES | `NULL` |

#### Table: `auth.mfa_recovery_code_sets`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `user_id` | `uuid` | NO | `NULL` |
| `mfa_factor_id` | `uuid` | NO | `NULL` |
| `failed_verification_count` | `integer` | NO | `0` |
| `verification_locked_until` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `auth.mfa_recovery_codes`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `mfa_recovery_code_set_id` | `uuid` | NO | `NULL` |
| `code_hash` | `text` | NO | `NULL` |
| `consumed_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `auth.oauth_authorizations`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `authorization_id` | `text` | NO | `NULL` |
| `client_id` | `uuid` | NO | `NULL` |
| `user_id` | `uuid` | YES | `NULL` |
| `redirect_uri` | `text` | NO | `NULL` |
| `scope` | `text` | NO | `NULL` |
| `state` | `text` | YES | `NULL` |
| `resource` | `text` | YES | `NULL` |
| `code_challenge` | `text` | YES | `NULL` |
| `code_challenge_method` | `USER-DEFINED` | YES | `NULL` |
| `response_type` | `USER-DEFINED` | NO | `'code'::auth.oauth_response_type` |
| `status` | `USER-DEFINED` | NO | `'pending'::auth.oauth_authorization_status` |
| `authorization_code` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `expires_at` | `timestamp with time zone` | NO | `(now() + '00:03:00'::interval)` |
| `approved_at` | `timestamp with time zone` | YES | `NULL` |
| `nonce` | `text` | YES | `NULL` |

#### Table: `auth.oauth_client_states`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `provider_type` | `text` | NO | `NULL` |
| `code_verifier` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `NULL` |

#### Table: `auth.oauth_clients`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `client_secret_hash` | `text` | YES | `NULL` |
| `registration_type` | `USER-DEFINED` | NO | `NULL` |
| `redirect_uris` | `text` | NO | `NULL` |
| `grant_types` | `text` | NO | `NULL` |
| `client_name` | `text` | YES | `NULL` |
| `client_uri` | `text` | YES | `NULL` |
| `logo_uri` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `deleted_at` | `timestamp with time zone` | YES | `NULL` |
| `client_type` | `USER-DEFINED` | NO | `'confidential'::auth.oauth_client_type` |
| `token_endpoint_auth_method` | `text` | NO | `NULL` |

#### Table: `auth.oauth_consents`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `user_id` | `uuid` | NO | `NULL` |
| `client_id` | `uuid` | NO | `NULL` |
| `scopes` | `text` | NO | `NULL` |
| `granted_at` | `timestamp with time zone` | NO | `now()` |
| `revoked_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `auth.one_time_tokens`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `user_id` | `uuid` | NO | `NULL` |
| `token_type` | `USER-DEFINED` | NO | `NULL` |
| `token_hash` | `text` | NO | `NULL` |
| `relates_to` | `text` | NO | `NULL` |
| `created_at` | `timestamp without time zone` | NO | `now()` |
| `updated_at` | `timestamp without time zone` | NO | `now()` |
| `expires_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `auth.refresh_tokens`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `instance_id` | `uuid` | YES | `NULL` |
| `id` | `bigint` | NO | `nextval('auth.refresh_tokens_id_seq'::regclass)` |
| `token` | `character varying` | YES | `NULL` |
| `user_id` | `character varying` | YES | `NULL` |
| `revoked` | `boolean` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |
| `parent` | `character varying` | YES | `NULL` |
| `session_id` | `uuid` | YES | `NULL` |

#### Table: `auth.saml_providers`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `sso_provider_id` | `uuid` | NO | `NULL` |
| `entity_id` | `text` | NO | `NULL` |
| `metadata_xml` | `text` | NO | `NULL` |
| `metadata_url` | `text` | YES | `NULL` |
| `attribute_mapping` | `jsonb` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |
| `name_id_format` | `text` | YES | `NULL` |

#### Table: `auth.saml_relay_states`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `sso_provider_id` | `uuid` | NO | `NULL` |
| `request_id` | `text` | NO | `NULL` |
| `for_email` | `text` | YES | `NULL` |
| `redirect_to` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |
| `flow_state_id` | `uuid` | YES | `NULL` |

#### Table: `auth.schema_migrations`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `version` | `character varying` | NO | `NULL` |

#### Table: `auth.scim_tokens`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `sso_provider_id` | `uuid` | NO | `NULL` |
| `token_hash` | `text` | NO | `NULL` |
| `prefix` | `text` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `expires_at` | `timestamp with time zone` | YES | `NULL` |
| `revoked_at` | `timestamp with time zone` | YES | `NULL` |
| `last_used_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `auth.scim_users`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `sso_provider_id` | `uuid` | NO | `NULL` |
| `user_id` | `uuid` | YES | `NULL` |
| `resource` | `jsonb` | NO | `NULL` |
| `user_name` | `text` | NO | `NULL` |
| `external_id` | `text` | YES | `NULL` |
| `active` | `boolean` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `deleted_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `auth.sessions`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `user_id` | `uuid` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |
| `factor_id` | `uuid` | YES | `NULL` |
| `aal` | `USER-DEFINED` | YES | `NULL` |
| `not_after` | `timestamp with time zone` | YES | `NULL` |
| `refreshed_at` | `timestamp without time zone` | YES | `NULL` |
| `user_agent` | `text` | YES | `NULL` |
| `ip` | `inet` | YES | `NULL` |
| `tag` | `text` | YES | `NULL` |
| `oauth_client_id` | `uuid` | YES | `NULL` |
| `refresh_token_hmac_key` | `text` | YES | `NULL` |
| `refresh_token_counter` | `bigint` | YES | `NULL` |
| `scopes` | `text` | YES | `NULL` |

#### Table: `auth.sso_domains`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `sso_provider_id` | `uuid` | NO | `NULL` |
| `domain` | `text` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `auth.sso_providers`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `NULL` |
| `resource_id` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |
| `disabled` | `boolean` | YES | `NULL` |

#### Table: `auth.users`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `instance_id` | `uuid` | YES | `NULL` |
| `id` | `uuid` | NO | `NULL` |
| `aud` | `character varying` | YES | `NULL` |
| `role` | `character varying` | YES | `NULL` |
| `email` | `character varying` | YES | `NULL` |
| `encrypted_password` | `character varying` | YES | `NULL` |
| `email_confirmed_at` | `timestamp with time zone` | YES | `NULL` |
| `invited_at` | `timestamp with time zone` | YES | `NULL` |
| `confirmation_token` | `character varying` | YES | `NULL` |
| `confirmation_sent_at` | `timestamp with time zone` | YES | `NULL` |
| `recovery_token` | `character varying` | YES | `NULL` |
| `recovery_sent_at` | `timestamp with time zone` | YES | `NULL` |
| `email_change_token_new` | `character varying` | YES | `NULL` |
| `email_change` | `character varying` | YES | `NULL` |
| `email_change_sent_at` | `timestamp with time zone` | YES | `NULL` |
| `last_sign_in_at` | `timestamp with time zone` | YES | `NULL` |
| `raw_app_meta_data` | `jsonb` | YES | `NULL` |
| `raw_user_meta_data` | `jsonb` | YES | `NULL` |
| `is_super_admin` | `boolean` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | YES | `NULL` |
| `phone` | `text` | YES | `NULL::character varying` |
| `phone_confirmed_at` | `timestamp with time zone` | YES | `NULL` |
| `phone_change` | `text` | YES | `''::character varying` |
| `phone_change_token` | `character varying` | YES | `''::character varying` |
| `phone_change_sent_at` | `timestamp with time zone` | YES | `NULL` |
| `confirmed_at` | `timestamp with time zone` | YES | `NULL` |
| `email_change_token_current` | `character varying` | YES | `''::character varying` |
| `email_change_confirm_status` | `smallint` | YES | `0` |
| `banned_until` | `timestamp with time zone` | YES | `NULL` |
| `reauthentication_token` | `character varying` | YES | `''::character varying` |
| `reauthentication_sent_at` | `timestamp with time zone` | YES | `NULL` |
| `is_sso_user` | `boolean` | NO | `false` |
| `deleted_at` | `timestamp with time zone` | YES | `NULL` |
| `is_anonymous` | `boolean` | NO | `false` |

#### Table: `auth.webauthn_challenges`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | YES | `NULL` |
| `challenge_type` | `text` | NO | `NULL` |
| `session_data` | `jsonb` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `expires_at` | `timestamp with time zone` | NO | `NULL` |

#### Table: `auth.webauthn_credentials`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `credential_id` | `bytea` | NO | `NULL` |
| `public_key` | `bytea` | NO | `NULL` |
| `attestation_type` | `text` | NO | `''::text` |
| `aaguid` | `uuid` | YES | `NULL` |
| `sign_count` | `bigint` | NO | `0` |
| `transports` | `jsonb` | NO | `'[]'::jsonb` |
| `backup_eligible` | `boolean` | NO | `false` |
| `backed_up` | `boolean` | NO | `false` |
| `friendly_name` | `text` | NO | `''::text` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `last_used_at` | `timestamp with time zone` | YES | `NULL` |

</details>

<details>
<summary><b>Schema: compliance Columns Detail</b></summary>

#### Table: `compliance.aml_flags`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `flag_type` | `character varying` | NO | `NULL` |
| `severity` | `character varying` | NO | `NULL` |
| `details` | `jsonb` | NO | `NULL` |
| `resolved` | `boolean` | NO | `false` |
| `resolved_by` | `uuid` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `compliance.compliance_rules`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `rule_name` | `character varying` | NO | `NULL` |
| `rule_type` | `character varying` | NO | `NULL` |
| `is_active` | `boolean` | NO | `true` |
| `config` | `jsonb` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `compliance.kyc_documents`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `document_type` | `character varying` | NO | `NULL` |
| `file_storage_path` | `character varying` | NO | `NULL` |
| `file_hash` | `character varying` | NO | `NULL` |
| `status` | `character varying` | NO | `'pending'::character varying` |
| `reviewed_by` | `uuid` | YES | `NULL` |
| `review_note` | `text` | YES | `NULL` |
| `reviewed_at` | `timestamp with time zone` | YES | `NULL` |
| `expires_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: config Columns Detail</b></summary>

#### Table: `config.feature_flags`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `flag_name` | `character varying` | NO | `NULL` |
| `is_enabled` | `boolean` | NO | `false` |
| `description` | `text` | YES | `NULL` |
| `updated_by` | `uuid` | NO | `NULL` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `config.platform_settings`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `key` | `character varying` | NO | `NULL` |
| `value` | `jsonb` | NO | `NULL` |
| `description` | `text` | YES | `NULL` |
| `updated_by` | `uuid` | NO | `NULL` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: events Columns Detail</b></summary>

#### Table: `events.event_outbox`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('events.event_outbox_id_seq'::regclass)` |
| `event_type` | `character varying` | NO | `NULL` |
| `aggregate_type` | `character varying` | NO | `NULL` |
| `aggregate_id` | `uuid` | NO | `NULL` |
| `payload` | `jsonb` | NO | `NULL` |
| `published` | `boolean` | NO | `false` |
| `published_at` | `timestamp with time zone` | YES | `NULL` |
| `retry_count` | `smallint` | NO | `0` |
| `last_error` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: notifications Columns Detail</b></summary>

#### Table: `notifications.notification_queue`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `notification_id` | `uuid` | NO | `NULL` |
| `retry_count` | `smallint` | NO | `0` |
| `max_retries` | `smallint` | NO | `3` |
| `next_attempt_at` | `timestamp with time zone` | NO | `now()` |
| `last_error` | `text` | YES | `NULL` |
| `locked_until` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `notifications.notifications`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `notification_type` | `character varying` | NO | `NULL` |
| `channel` | `character varying` | NO | `NULL` |
| `recipient_address` | `character varying` | NO | `NULL` |
| `subject` | `character varying` | YES | `NULL` |
| `body_text` | `text` | NO | `NULL` |
| `status` | `character varying` | NO | `'pending'::character varying` |
| `sent_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: payments Columns Detail</b></summary>

#### Table: `payments.deposits`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `gateway_id` | `smallint` | NO | `NULL` |
| `gateway_reference` | `character varying` | NO | `NULL` |
| `amount` | `numeric` | NO | `NULL` |
| `fee` | `numeric` | NO | `0.0000` |
| `net_amount` | `numeric` | NO | `NULL` |
| `currency` | `character varying` | NO | `'USD'::character varying` |
| `status` | `character varying` | NO | `'pending'::character varying` |
| `webhook_payload` | `jsonb` | YES | `NULL` |
| `idempotency_key` | `character varying` | NO | `NULL` |
| `completed_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `payments.idempotency_keys`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `key` | `character varying` | NO | `NULL` |
| `response` | `jsonb` | YES | `NULL` |
| `expires_at` | `timestamp with time zone` | NO | `(now() + '7 days'::interval)` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `payments.payment_gateways`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `smallint` | NO | `nextval('payments.payment_gateways_id_seq'::regclass)` |
| `name` | `character varying` | NO | `NULL` |
| `provider_type` | `character varying` | NO | `NULL` |
| `is_active` | `boolean` | NO | `true` |
| `config` | `jsonb` | NO | `'{}'::jsonb` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `payments.payment_webhook_logs`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('payments.payment_webhook_logs_id_seq'::regclass)` |
| `gateway_id` | `smallint` | NO | `NULL` |
| `headers` | `jsonb` | NO | `NULL` |
| `body` | `jsonb` | NO | `NULL` |
| `signature_valid` | `boolean` | YES | `NULL` |
| `processed` | `boolean` | NO | `false` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `payments.withdrawals`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `gateway_id` | `smallint` | NO | `NULL` |
| `amount` | `numeric` | NO | `NULL` |
| `fee` | `numeric` | NO | `0.0000` |
| `net_amount` | `numeric` | NO | `NULL` |
| `currency` | `character varying` | NO | `'USD'::character varying` |
| `status` | `character varying` | NO | `'pending'::character varying` |
| `reviewed_by` | `uuid` | YES | `NULL` |
| `review_note` | `text` | YES | `NULL` |
| `gateway_reference` | `character varying` | YES | `NULL` |
| `idempotency_key` | `character varying` | NO | `NULL` |
| `completed_at` | `timestamp with time zone` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: pricing Columns Detail</b></summary>

#### Table: `pricing.candles`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('pricing.candles_id_seq'::regclass)` |
| `symbol` | `character varying` | NO | `NULL` |
| `granularity_seconds` | `integer` | NO | `NULL` |
| `open_time` | `timestamp with time zone` | NO | `NULL` |
| `close_time` | `timestamp with time zone` | NO | `NULL` |
| `open_price` | `numeric` | NO | `NULL` |
| `high_price` | `numeric` | NO | `NULL` |
| `low_price` | `numeric` | NO | `NULL` |
| `close_price` | `numeric` | NO | `NULL` |
| `volume` | `bigint` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `tick_count` | `integer` | YES | `NULL` |
| `source` | `text` | NO | `NULL` |

#### Table: `pricing.market_hours`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `asset_symbol` | `character varying` | NO | `NULL` |
| `opens_at` | `time without time zone` | NO | `NULL` |
| `closes_at` | `time without time zone` | NO | `NULL` |
| `timezone` | `character varying` | NO | `'UTC'::character varying` |
| `is_24_7` | `boolean` | NO | `false` |

#### Table: `pricing.price_ticks`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('pricing.price_ticks_id_seq'::regclass)` |
| `symbol` | `character varying` | NO | `NULL` |
| `tick_time` | `timestamp with time zone` | NO | `NULL` |
| `bid_price` | `numeric` | NO | `NULL` |
| `ask_price` | `numeric` | NO | `NULL` |
| `mid_price` | `numeric` | NO | `NULL` |
| `volume` | `bigint` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `source` | `character varying` | NO | `'live'::character varying` |

</details>

<details>
<summary><b>Schema: realtime Columns Detail</b></summary>

#### Table: `realtime.messages`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `topic` | `text` | NO | `NULL` |
| `extension` | `text` | NO | `NULL` |
| `payload` | `jsonb` | YES | `NULL` |
| `event` | `text` | YES | `NULL` |
| `private` | `boolean` | YES | `false` |
| `updated_at` | `timestamp without time zone` | NO | `now()` |
| `inserted_at` | `timestamp without time zone` | NO | `now()` |
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `binary_payload` | `bytea` | YES | `NULL` |
| `skip_broadcast` | `boolean` | NO | `false` |

#### Table: `realtime.schema_migrations`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `version` | `bigint` | NO | `NULL` |
| `inserted_at` | `timestamp without time zone` | YES | `now()` |

#### Table: `realtime.subscription`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `NULL` |
| `subscription_id` | `uuid` | NO | `NULL` |
| `entity` | `regclass` | NO | `NULL` |
| `filters` | `ARRAY` | NO | `'{}'::realtime.user_defined_filter[]` |
| `claims` | `jsonb` | NO | `NULL` |
| `claims_role` | `regrole` | NO | `NULL` |
| `created_at` | `timestamp without time zone` | NO | `timezone('utc'::text, now())` |
| `action_filter` | `text` | YES | `'*'::text` |
| `selected_columns` | `ARRAY` | YES | `NULL` |

</details>

<details>
<summary><b>Schema: referral Columns Detail</b></summary>

#### Table: `referral.referral_codes`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `code` | `character varying` | NO | `NULL` |
| `owner_id` | `uuid` | NO | `NULL` |
| `is_active` | `boolean` | NO | `true` |
| `max_uses` | `integer` | YES | `NULL` |
| `use_count` | `integer` | NO | `0` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `referral.referral_commissions`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `referral_id` | `uuid` | NO | `NULL` |
| `source_contract_id` | `uuid` | NO | `NULL` |
| `commission_amount` | `numeric` | NO | `NULL` |
| `status` | `character varying` | NO | `'pending'::character varying` |
| `paid_at` | `timestamp with time zone` | YES | `NULL` |
| `payout_tx_id` | `uuid` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `referral.referrals`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `referred_user_id` | `uuid` | NO | `NULL` |
| `referrer_id` | `uuid` | NO | `NULL` |
| `referral_code` | `character varying` | NO | `NULL` |
| `status` | `character varying` | NO | `'active'::character varying` |
| `commission_percentage` | `numeric` | NO | `10.00` |
| `total_commission_earned` | `numeric` | NO | `0.0000` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: storage Columns Detail</b></summary>

#### Table: `storage.buckets`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `text` | NO | `NULL` |
| `name` | `text` | NO | `NULL` |
| `owner` | `uuid` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `now()` |
| `updated_at` | `timestamp with time zone` | YES | `now()` |
| `public` | `boolean` | YES | `false` |
| `avif_autodetection` | `boolean` | YES | `false` |
| `file_size_limit` | `bigint` | YES | `NULL` |
| `allowed_mime_types` | `ARRAY` | YES | `NULL` |
| `owner_id` | `text` | YES | `NULL` |
| `type` | `USER-DEFINED` | NO | `'STANDARD'::storage.buckettype` |
| `versioning_status` | `text` | NO | `'DISABLED'::text` |
| `lifecycle_configuration` | `jsonb` | YES | `NULL` |
| `lifecycle_configuration_generation` | `uuid` | YES | `NULL` |

#### Table: `storage.buckets_analytics`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `name` | `text` | NO | `NULL` |
| `type` | `USER-DEFINED` | NO | `'ANALYTICS'::storage.buckettype` |
| `format` | `text` | NO | `'ICEBERG'::text` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `deleted_at` | `timestamp with time zone` | YES | `NULL` |

#### Table: `storage.buckets_vectors`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `text` | NO | `NULL` |
| `type` | `USER-DEFINED` | NO | `'VECTOR'::storage.buckettype` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `storage.migrations`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `integer` | NO | `NULL` |
| `name` | `character varying` | NO | `NULL` |
| `hash` | `character varying` | NO | `NULL` |
| `executed_at` | `timestamp without time zone` | YES | `CURRENT_TIMESTAMP` |

#### Table: `storage.objects`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `bucket_id` | `text` | YES | `NULL` |
| `name` | `text` | YES | `NULL` |
| `owner` | `uuid` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | YES | `now()` |
| `updated_at` | `timestamp with time zone` | YES | `now()` |
| `last_accessed_at` | `timestamp with time zone` | YES | `now()` |
| `metadata` | `jsonb` | YES | `NULL` |
| `path_tokens` | `ARRAY` | YES | `NULL` |
| `version` | `text` | YES | `NULL` |
| `owner_id` | `text` | YES | `NULL` |
| `user_metadata` | `jsonb` | YES | `NULL` |
| `archived_at` | `timestamp with time zone` | YES | `NULL` |
| `is_delete_marker` | `boolean` | NO | `false` |
| `is_versioned` | `boolean` | NO | `false` |

#### Table: `storage.s3_multipart_uploads`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `text` | NO | `NULL` |
| `in_progress_size` | `bigint` | NO | `0` |
| `upload_signature` | `text` | NO | `NULL` |
| `bucket_id` | `text` | NO | `NULL` |
| `key` | `text` | NO | `NULL` |
| `version` | `text` | NO | `NULL` |
| `owner_id` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `user_metadata` | `jsonb` | YES | `NULL` |
| `metadata` | `jsonb` | YES | `NULL` |

#### Table: `storage.s3_multipart_uploads_parts`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `upload_id` | `text` | NO | `NULL` |
| `size` | `bigint` | NO | `0` |
| `part_number` | `integer` | NO | `NULL` |
| `bucket_id` | `text` | NO | `NULL` |
| `key` | `text` | NO | `NULL` |
| `etag` | `text` | NO | `NULL` |
| `owner_id` | `text` | YES | `NULL` |
| `version` | `text` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `storage.vector_indexes`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `text` | NO | `gen_random_uuid()` |
| `name` | `text` | NO | `NULL` |
| `bucket_id` | `text` | NO | `NULL` |
| `data_type` | `text` | NO | `NULL` |
| `dimension` | `integer` | NO | `NULL` |
| `distance_metric` | `text` | NO | `NULL` |
| `metadata_configuration` | `jsonb` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: trading Columns Detail</b></summary>

#### Table: `trading.asset_config`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `asset_symbol` | `character varying` | NO | `NULL` |
| `min_stake` | `numeric` | NO | `NULL` |
| `max_stake_per_trade` | `numeric` | NO | `NULL` |
| `min_duration_seconds` | `integer` | NO | `NULL` |
| `max_duration_seconds` | `integer` | NO | `NULL` |
| `payout_rate` | `numeric` | NO | `NULL` |
| `is_active` | `boolean` | NO | `true` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `max_exposure` | `numeric` | YES | `NULL` |
| `volatility_multiplier` | `numeric` | YES | `NULL` |
| `updated_by` | `uuid` | YES | `NULL` |
| `valid_from` | `timestamp with time zone` | YES | `NULL` |
| `valid_until` | `timestamp with time zone` | YES | `NULL` |

#### Table: `trading.assets`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `symbol` | `character varying` | NO | `NULL` |
| `name` | `character varying` | NO | `NULL` |
| `asset_type` | `character varying` | NO | `NULL` |
| `is_active` | `boolean` | NO | `true` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `min_stake` | `numeric` | NO | `1.00` |
| `max_stake` | `numeric` | NO | `500.00` |
| `min_expiry_seconds` | `integer` | NO | `60` |
| `max_expiry_seconds` | `integer` | NO | `86400` |
| `pip_decimal_places` | `smallint` | NO | `5` |

#### Table: `trading.binary_contracts`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `asset_symbol` | `character varying` | NO | `NULL` |
| `stake` | `numeric` | NO | `NULL` |
| `contract_type` | `character varying` | NO | `NULL` |
| `expiry_price` | `numeric` | YES | `NULL` |
| `strike_price` | `numeric` | NO | `NULL` |
| `payout_rate` | `numeric` | NO | `NULL` |
| `potential_payout` | `numeric` | NO | `NULL` |
| `purchase_time` | `timestamp with time zone` | NO | `now()` |
| `expiry_time` | `timestamp with time zone` | NO | `NULL` |
| `status` | `character varying` | NO | `'active'::character varying` |
| `settlement_reason` | `character varying` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `settled_at` | `timestamp with time zone` | YES | `NULL` |
| `lock_tx_id` | `uuid` | YES | `NULL` |
| `payout_tx_id` | `uuid` | YES | `NULL` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `account_type` | `character varying` | NO | `'real'::character varying` |

#### Table: `trading.contract_events`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('trading.contract_events_id_seq'::regclass)` |
| `contract_id` | `uuid` | NO | `NULL` |
| `event_type` | `character varying` | NO | `NULL` |
| `details` | `jsonb` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `trading.demo_trade_idempotency`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `user_id` | `uuid` | NO | `NULL` |
| `idempotency_key` | `character varying` | NO | `NULL` |
| `request_hash` | `character` | NO | `NULL` |
| `response_payload` | `jsonb` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

</details>

<details>
<summary><b>Schema: vault Columns Detail</b></summary>

#### Table: `vault.secrets`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `name` | `text` | YES | `NULL` |
| `description` | `text` | NO | `''::text` |
| `secret` | `text` | NO | `NULL` |
| `key_id` | `uuid` | YES | `NULL` |
| `nonce` | `bytea` | YES | `vault._crypto_aead_det_noncegen()` |
| `created_at` | `timestamp with time zone` | NO | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp with time zone` | NO | `CURRENT_TIMESTAMP` |

</details>

<details>
<summary><b>Schema: wallet Columns Detail</b></summary>

#### Table: `wallet.demo_wallet_reset_events`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('wallet.demo_wallet_reset_events_id_seq'::regclass)` |
| `user_id` | `uuid` | NO | `NULL` |
| `idempotency_key` | `character varying` | NO | `NULL` |
| `response_payload` | `jsonb` | NO | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |

#### Table: `wallet.ledger_entries`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `transaction_id` | `uuid` | NO | `NULL` |
| `wallet_id` | `uuid` | NO | `NULL` |
| `entry_type` | `character varying` | NO | `NULL` |
| `amount` | `numeric` | NO | `NULL` |
| `balance_after` | `numeric` | NO | `NULL` |
| `reference_type` | `character varying` | NO | `NULL` |
| `reference_id` | `uuid` | YES | `NULL` |
| `description` | `text` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `balance_before` | `numeric` | YES | `NULL` |

#### Table: `wallet.wallet_version_log`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `bigint` | NO | `nextval('wallet.wallet_version_log_id_seq'::regclass)` |
| `wallet_id` | `uuid` | NO | `NULL` |
| `version` | `integer` | NO | `NULL` |
| `change_reason` | `character varying` | NO | `NULL` |
| `changed_by` | `uuid` | YES | `NULL` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `version_before` | `integer` | YES | `NULL` |
| `version_after` | `integer` | YES | `NULL` |

#### Table: `wallet.wallets`

| Column Name | Data Type | Is Nullable | Default |
|-------------|-----------|-------------|---------|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | `NULL` |
| `balance` | `numeric` | NO | `0.0000` |
| `locked_balance` | `numeric` | NO | `0.0000` |
| `currency` | `character varying` | NO | `'KES'::character varying` |
| `version` | `integer` | NO | `1` |
| `created_at` | `timestamp with time zone` | NO | `now()` |
| `status` | `character varying` | NO | `'active'::character varying` |
| `updated_at` | `timestamp with time zone` | NO | `now()` |
| `available_balance` | `numeric` | YES | `NULL` |
| `account_type` | `character varying` | NO | `'real'::character varying` |

</details>

