# Account Cleanup & Trading UI Hardcoding Diagnosis

## Task 1 — Production Account Cleanup

**Status: Executed & Verified**

The cleanup ran against `DATABASE_URL` only after verifying that it resolved to a different database identity from `TEST_DATABASE_URL`. The selection matched 59 `@example.com` users. The five named staff accounts had one account each, so no duplicate staff accounts qualified for removal.

Before deletion, I checked the hash implementation: `AdminRepository.computeEntryHash()` includes `actorId` in the SHA-256 payload. Because changing `actor_id` would invalidate the hash, the 81 candidate audit rows were deleted instead of updated. They were a terminal suffix (IDs 74–154); no retained row followed them. The immutable delete trigger was disabled only inside the transaction and re-enabled before commit. The retained audit rows had two broken previous-hash links before cleanup and still had two afterward; no new link mismatches were introduced. The delete trigger is enabled after commit. The verification-job implementation was not present in this repository.

The transaction also deleted only candidate-owned records in the relevant dependency order. `payments.idempotency_keys` has no `user_id`; its 10 keys were identified through the candidate users’ withdrawals/deposits and deleted only after those payment rows. The historical withdrawal was snapshotted and compared before commit.

The one-shot Node/`pg` transaction script completed with this summary:

```json
{
  "status": "COMMITTED",
  "counts": {
    "before_users": 68,
    "deleted_users": 59,
    "after_users": 9
  },
  "deletedRows": {
    "audit_logs": 81,
    "contract_events": 0,
    "binary_contracts": 0,
    "b2c_outbox": 8,
    "withdrawals": 10,
    "deposits": 0,
    "idempotency_keys": 10,
    "ledger_entries": 0,
    "wallets": 1,
    "user_roles": 0,
    "sessions": 0,
    "kyc_documents": 0,
    "users": 59
  },
  "protected": {
    "emails_remaining": 4,
    "historical_user_remaining": 1,
    "historical_withdrawal_unchanged": 1,
    "staff_accounts_remaining": 5
  },
  "audit": {
    "deleted_test_rows": 81,
    "remaining_rows": 4,
    "hash_includes_actor_id": true,
    "removed_rows_were_terminal_suffix": true,
    "broken_links_before": 2,
    "broken_links_after": 2
  }
}
```

| Transaction result | Rows |
|---|---:|
| `app_auth.users` before | 68 |
| Candidate users deleted | 59 |
| `app_auth.users` after | 9 |
| `admin.audit_logs` test rows deleted | 81 |
| `payments.b2c_outbox` | 8 |
| `payments.withdrawals` | 10 |
| `payments.idempotency_keys` | 10 |
| `wallet.wallets` | 1 |
| Other requested dependent rows (contracts/events, deposits, ledger entries, roles, sessions, KYC docs) | 0 |

Post-commit checks found zero candidate users or candidate audit rows, all four protected email accounts and all five staff accounts still present, the historical user still present, and the protected withdrawal unchanged (`id=235d9ef4-8cde-42c9-be63-9accc9ac09d0`, still owned by `just1abacha@gmail.com`, status `approved`). The remaining user emails are:

```text
admin@skiespro.internal
compliance@skiespro.internal
finance@skiespro.internal
itsphestone@gmail.com
just1abacha@gmail.com
risk@skiespro.internal
ryan41rays@gmail.com
support@skiespro.internal
system@skiespro.internal
```

## Task 2 — Trading UI Diagnosis

**Status: Read-Only Diagnosis Complete**

`frontend/src/modules/trading/components/OrderForm.tsx` uses the asset props when present, but substitutes these defaults when the fields are absent or falsy:

```tsx
const payoutRate = asset?.payoutRate || 0.6;
const minStake = asset?.minStake || 100;
...
Payout +{(payoutRate * 100).toFixed(0)}%
...
if (numericStake < minStake) return `Minimum stake is KES ${minStake}`;
```

The UI therefore displays `60%` and a `KES 100` minimum when the selected asset has no `payoutRate` or `minStake`. The same fallback pattern exists in the frontend trading service and asset selector.

The frontend requests the list endpoint from `frontend/src/modules/trading/services/tradingService.ts`:

```ts
const response = await apiClient.get<ApiResponse<Asset[]> | Asset[]>(
  '/api/v1/trading/assets'
);
...
payoutRate: Number(asset.payoutRate) || 0.6,
minStake: Number(asset.minStake) || 100,
```

`useTrading` stores the result in component-local React state (`useState`), then sets `selectedAsset` from that list. It is not using a Zustand or Redux store. The load runs in an effect when the active symbol changes.

On the backend, `GET /api/v1/trading/assets` calls `AssetService.listAssets()`, which returns `AssetRepository.getAllActive()`. Its SQL selects from `trading.assets` only:

```sql
SELECT *, asset_type AS "assetType", is_active AS "isActive",
       pip_decimal_places AS "pipDecimalPlaces"
FROM trading.assets
WHERE is_active = TRUE
```

It does not read or join `trading.asset_config`, where the Risk Dashboard updates payout and stake settings. The backend has an `AssetConfigRepository` query for those values, but `listAssets()` does not use it. As a result, the list response does not provide the camel-case `payoutRate` and `minStake` fields expected by the frontend; the frontend converts missing values into `0.6` and `100`.

**Root cause:** this is not stale global-store state. The trader UI consumes `/api/v1/trading/assets`, whose backend list query omits `trading.asset_config`; the frontend fallback then masks the missing response fields with 60% and KES 100. The detail endpoint returns `{ asset, config }` nested, while the frontend detail normalizer expects a flat asset, and the current `useTrading` list-loading flow does not call that detail endpoint.
