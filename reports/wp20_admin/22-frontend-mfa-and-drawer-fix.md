# WP-20 Execution Report: User Drawer State & MFA Step-Up Exchange Fixes

## Status
Executed & Verified

---

## Pre-Check Findings (P1-P3)

- **P1. `useAdminUsers.ts` `selectUser` State**:
  ```ts
  const selectUser = useCallback(async (id: string) => {
    setSelectedUser(null); // Clear stale user state immediately
    setIsDrawerLoading(true);
    // ...
  });
  ```
  *Finding*: Clearing `selectedUser` to `null` before fetching details caused `isOpen={!!selectedUser}` to evaluate to `false`, closing the drawer during loading.

- **P2. `AssetConfigModal.tsx` `handleMfaConfirm`**:
  ```ts
  const handleMfaConfirm = async (totpCode: string) => {
    await onConfirm(asset.symbol, { ..., totp_code: totpCode });
    onClose();
  };
  ```
  *Finding*: Sent raw 6-digit TOTP code in `totp_code` / `X-Admin-MFA-Token` header, bypassing the MFA step-up JWT exchange endpoint.

- **P3. MFA Verification Pattern**:
  Confirmed that administrative step-up requires exchanging the 6-digit TOTP via `POST /api/v1/auth/admin-mfa/step-up` to obtain a signed JWT `admin_mfa_token`, then passing that signed JWT in header `X-Admin-MFA-Token`.

---

## Task 1 — User Drawer State Logic (`useAdminUsers.ts` & `UserManagementPage.tsx`)

### `useAdminUsers.ts`
```ts
export function useAdminUsers() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);

  const selectUser = useCallback(async (id: string) => {
    setSelectedUserId(id);
    setSelectedUser(null);
    setIsDrawerLoading(true);
    setError(null);
    try {
      const user = await adminApiClient.getUserById(id);
      setSelectedUser(user);
    } catch (err) {
      setError((err as Error).message || 'Failed to load user details.');
    } finally {
      setIsDrawerLoading(false);
    }
  }, []);

  const clearSelectedUser = useCallback(() => {
    setSelectedUserId(null);
    setSelectedUser(null);
    setLedger([]);
    setIsDrawerLoading(false);
    setIsLedgerLoading(false);
  }, []);

  return {
    selectedUserId,
    selectedUser,
    // ...
  };
}
```

### `UserManagementPage.tsx` Drawer Prop
```tsx
<UserDetailDrawer
  user={selectedUser}
  ledger={ledger}
  isOpen={!!selectedUserId || !!selectedUser}
  isDrawerLoading={isDrawerLoading}
  isLedgerLoading={isLedgerLoading}
  onClose={clearSelectedUser}
  onFetchLedger={fetchUserLedger}
/>
```

---

## Task 2 — MFA Step-Up Exchange (`AssetConfigModal.tsx`)

```ts
  const handleMfaConfirm = async (totpCode: string) => {
    try {
      // Step A (Exchange): Exchange 6-digit TOTP code for signed JWT step-up token
      const stepUpRes = await apiClient.post<any>('/api/v1/auth/admin-mfa/step-up', {
        totp_code: totpCode,
      });
      const mfaToken =
        stepUpRes?.data?.admin_mfa_token ||
        stepUpRes?.admin_mfa_token ||
        stepUpRes?.data?.data?.admin_mfa_token;

      if (!mfaToken) {
        throw new Error('Failed to obtain administrator MFA step-up token.');
      }

      // Step B (Action): Execute update with signed JWT step-up token
      await onConfirm(asset.symbol, {
        payout_rate: payoutRate,
        min_stake: minStake,
        max_stake: maxStake,
        is_active: isActive,
        totp_code: mfaToken,
      });

      setIsMfaOpen(false);
      onClose();
    } catch (err: any) {
      const errorMsg = err.message || 'MFA step-up verification failed.';
      setError(errorMsg);
      throw err;
    }
  };
```

---

## Task 3 — Fixed Data Mapping in `UserDetailDrawer.tsx`

```tsx
  const tradeDirectionLabel = (direction?: string) => {
    if (!direction) return 'CALL';
    const normalized = direction.toLowerCase();
    if (normalized === 'higher' || normalized === 'call') return 'HIGH';
    if (normalized === 'lower' || normalized === 'put') return 'LOW';
    return direction.toUpperCase();
  };
```
And added `account_type` badge (`[REAL]` / `[DEMO]`) to recent trade items so admins can distinguish real vs demo contracts in trade activity.

---

## Consecutive Full-Suite Test Verification

### Run 1 Summary
```text
Test Suites: 57 passed, 57 total
Tests:       385 passed, 385 total
Snapshots:   0 total
Time:        432.305 s
```

### Run 2 Summary
```text
Test Suites: 57 passed, 57 total
Tests:       385 passed, 385 total
Snapshots:   0 total
Time:        439.858 s
```

---

## Typechecks
- **Backend Typecheck (`npm run typecheck`)**: 0 errors
- **Frontend Typecheck (`cd frontend && npx tsc --noEmit`)**: 0 errors
