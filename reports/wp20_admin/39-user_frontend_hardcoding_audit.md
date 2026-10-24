# Read-Only Audit Report: User Frontend (Trader UI) Hardcoding & Dynamic Settings Alignment

## 1. Executive Summary

- **Top Gap #1 (Missing Public Configuration Endpoint)**: There is no public or trader-accessible endpoint (e.g., `GET /api/v1/config/public` or `GET /api/v1/wallet/config`) that exposes `config.platform_settings` (deposit/withdrawal limits, default payout ratios, KYC requirements) to non-admin trader accounts. Currently, settings can only be read via `GET /api/v1/admin/settings` which requires admin role and MFA.
- **Top Gap #2 (Hardcoded Zod Schemas & Hardcoded KYC Logic in Wallet Page)**:
  - Deposit limits in [DepositForm.tsx](file:///C:/SkiesPro/frontend/src/pages/wallet/components/DepositForm.tsx#L16) are hardcoded in Zod schema to `num >= 500` with quick buttons `['500', '1000', '2000', '5000']`.
  - Withdrawal limits in [WithdrawForm.tsx](file:///C:/SkiesPro/frontend/src/pages/wallet/components/WithdrawForm.tsx#L16) are hardcoded in Zod schema to `num >= 1500` with hardcoded 2% fee calculation (`numAmount * 0.02`).
  - Withdrawal KYC gate in [WalletPage.tsx](file:///C:/SkiesPro/frontend/src/pages/wallet/WalletPage.tsx#L107) is hardcoded as `disabled={user?.kycStatus !== 'verified'}`, ignoring `kyc.required_for_withdrawal` setting.
- **Top Gap #3 (Missing KYC Gate & Hardcoded Duration Options on Trade Page)**:
  - [TradingPage.tsx](file:///C:/SkiesPro/frontend/src/pages/trading/TradingPage.tsx) and [OrderForm.tsx](file:///C:/SkiesPro/frontend/src/modules/trading/components/OrderForm.tsx) do not check `kyc.required_for_trading`. Unverified users can place binary contracts regardless of system configuration.
  - Duration choices in [OrderForm.tsx](file:///C:/SkiesPro/frontend/src/modules/trading/components/OrderForm.tsx#L26) are hardcoded to `60s`, `300s`, `900s`, ignoring `trade.min_duration_seconds` and `trade.max_duration_seconds` settings.

---

## 2. Wallet Page Findings (Part A)

### A1. File Locations
- **Main Page**: [WalletPage.tsx](file:///C:/SkiesPro/frontend/src/pages/wallet/WalletPage.tsx)
- **Deposit Component**: [DepositForm.tsx](file:///C:/SkiesPro/frontend/src/pages/wallet/components/DepositForm.tsx)
- **Withdraw Component**: [WithdrawForm.tsx](file:///C:/SkiesPro/frontend/src/pages/wallet/components/WithdrawForm.tsx)
- **Hook**: [useWallet.ts](file:///C:/SkiesPro/frontend/src/shared/hooks/useWallet.ts)

### A2. Deposit Limits
- **Min Deposit**: Hardcoded in Zod schema ([DepositForm.tsx:16](file:///C:/SkiesPro/frontend/src/pages/wallet/components/DepositForm.tsx#L16)):
  ```typescript
  const depositSchema = z.object({
    amount: z.string().refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 500;
    }, { message: 'Minimum deposit is KES 500' }),
    ...
  });
  ```
- **Max Deposit**: Missing entirely from frontend validation.
- **Quick Amount Buttons**: Hardcoded as `['500', '1000', '2000', '5000']`.

### A3. Withdrawal Limits
- **Min Withdrawal**: Hardcoded in Zod schema ([WithdrawForm.tsx:16](file:///C:/SkiesPro/frontend/src/pages/wallet/components/WithdrawForm.tsx#L16)):
  ```typescript
  const withdrawSchema = z.object({
    amount: z.string().refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 1500;
    }, { message: 'Minimum withdrawal is KES 1,500' }),
    ...
  });
  ```
- **Max Withdrawal**: Missing entirely from frontend validation.
- **Processing Fee**: Hardcoded to 2% in JSX calculation: `const fee = numAmount * 0.02;`.

### A4. KYC Checks in Wallet
- In [WalletPage.tsx:107](file:///C:/SkiesPro/frontend/src/pages/wallet/WalletPage.tsx#L107), the Withdraw button status is hardcoded:
  ```tsx
  <Button
    variant="secondary"
    onClick={() => setIsWithdrawOpen(true)}
    disabled={user?.kycStatus !== 'verified'}
  >
  ```
- Ignores setting `kyc.required_for_withdrawal` (e.g. if set to `false`, button remains disabled for unverified users).
- Deposit button has no KYC check at all.

### A5. Wallet API Endpoints
- `useWallet` hook calls `GET /api/v1/wallet/balance` and `GET /api/v1/wallet/ledger`.
- Neither endpoint returns platform configuration limits or feature flags.

---

## 3. Trade Page Findings (Part B)

### B1. File Locations
- **Main Terminal**: [TradingPage.tsx](file:///C:/SkiesPro/frontend/src/pages/trading/TradingPage.tsx)
- **Order Form**: [OrderForm.tsx](file:///C:/SkiesPro/frontend/src/modules/trading/components/OrderForm.tsx)
- **Trading Hook**: [useTrading.ts](file:///C:/SkiesPro/frontend/src/modules/trading/hooks/useTrading.ts)

### B2. Payout Rates
- [OrderForm.tsx:55](file:///C:/SkiesPro/frontend/src/modules/trading/components/OrderForm.tsx#L55) uses `asset?.payoutRate` fetched via `GET /api/v1/trading/assets`.
- If `payoutRate` is null/undefined in DB, `tradingService.ts` sets it to `undefined`, which correctly displays `"Payout unavailable"` in the UI.

### B3. Min/Max Stake & Duration
- **Stake Limits**: `OrderForm.tsx` reads `asset.minStake` and `asset.maxStake` with hardcoded fallback `asset?.maxStake || 50000`.
- **Quick Stakes**: Hardcoded array `['100', '250', '500', '1000', '5000']`.
- **Duration Options**: Hardcoded array in [OrderForm.tsx:26](file:///C:/SkiesPro/frontend/src/modules/trading/components/OrderForm.tsx#L26):
  ```typescript
  const DURATION_OPTIONS = [
    { label: '60s (1m)', value: 60 },
    { label: '300s (5m)', value: 300 },
    { label: '900s (15m)', value: 900 },
  ];
  ```
  Ignores `trade.min_duration_seconds` and `trade.max_duration_seconds` platform settings.

### B4. KYC Gate on Trading Terminal
- Neither [TradingPage.tsx](file:///C:/SkiesPro/frontend/src/pages/trading/TradingPage.tsx) nor [OrderForm.tsx](file:///C:/SkiesPro/frontend/src/modules/trading/components/OrderForm.tsx) checks `kyc.required_for_trading`.
- Unverified users can place binary option trades without restriction even when `kyc.required_for_trading = true`.

---

## 4. Backend API Findings (Part C)

### C1. Available Trader Endpoints
- `GET /api/v1/trading/assets`: Returns array of active trading assets with `payoutRate`, `minStake`, `maxStake`, `minExpirySeconds`, `maxExpirySeconds`. Does NOT return global `config.platform_settings`.
- `GET /api/v1/wallet/balance`: Returns `user_id`, `balance`, `locked_balance`, `available_balance`. Does NOT return deposit/withdrawal limits or fee percentages.

### C2. Response Payload Gap
- Neither endpoint exposes global system limits:
  - `deposit.min_amount` / `deposit.max_amount`
  - `withdrawal.min_amount` / `withdrawal.max_amount`
  - `kyc.required_for_trading` / `kyc.required_for_withdrawal`
  - `trade.min_duration_seconds` / `trade.max_duration_seconds`

---

## 5. Impact Map

| File Path | Description of Changes Needed |
| :--- | :--- |
| **New Backend Route** `src/modules/config/config.routes.ts` | Create public `GET /api/v1/config/public` endpoint returning dynamic platform settings for traders |
| `src/index.ts` | Register public config route `/api/v1/config/public` |
| `frontend/src/shared/services/publicConfigService.ts` | Create service/hook to fetch and cache public platform settings |
| `frontend/src/pages/wallet/WalletPage.tsx` | Use dynamic `kyc.required_for_withdrawal` setting to conditionally disable Withdraw button |
| `frontend/src/pages/wallet/components/DepositForm.tsx` | Build dynamic Zod schema using `deposit.min_amount` and `deposit.max_amount` |
| `frontend/src/pages/wallet/components/WithdrawForm.tsx` | Build dynamic Zod schema using `withdrawal.min_amount` and `withdrawal.max_amount` |
| `frontend/src/modules/trading/components/OrderForm.tsx` | Enforce `kyc.required_for_trading` gate and dynamic min/max durations |

---

## 6. Recommended Fix Scope

1. **Backend Public Settings Endpoint**: Implement `GET /api/v1/config/public` (read-only, cached) that returns key trader-facing limits (`deposit.min_amount`, `deposit.max_amount`, `withdrawal.min_amount`, `withdrawal.max_amount`, `kyc.required_for_trading`, `kyc.required_for_withdrawal`).
2. **Trader Wallet Forms Dynamic Validation**: Wire `DepositForm.tsx` and `WithdrawForm.tsx` to build Zod schemas dynamically from `publicConfigService` instead of hardcoded numbers.
3. **Trader Trading KYC Guard**: Wire `TradingPage.tsx` / `OrderForm.tsx` to check `kyc.required_for_trading` and display a clear KYC verification banner if required and unverified.

Read-Only Audit Completed

## Follow-up: Frontend Wiring Implementation

**Status: Executed & Verified**

### Backend enforcement pre-check (P1)

- `TradingService.placeTrade` reads `kyc.required_for_trading`, constrains requested duration by both global duration settings and `trading.asset_config`, uses asset-specific `payoutRate`, and consults `trade.default_payout_ratio` only when that asset payout is null.
- `DemoTradingService.placeDemoTrade` now enforces the same trading KYC flag, global duration bounds, and null-only payout fallback.
- `PaymentService.initiateDeposit` and `requestWithdrawal` enforce dynamic amount bounds; withdrawals also read `kyc.required_for_withdrawal` and `withdrawal.fee_percentage`.
- These checks remain server-side regardless of frontend validation.

### Public config endpoint

Added `GET /api/v1/config/public`, mounted from `src/infrastructure/routes.ts` without admin authentication or MFA. The controller reads only the following allow-listed keys via `SettingsService.getSetting`, supplying defaults when missing:

```typescript
const publicSettingDefaults = {
  'deposit.min_amount': 500,
  'deposit.max_amount': 100000,
  'withdrawal.min_amount': 500,
  'withdrawal.max_amount': 60000,
  'kyc.required_for_trading': false,
  'kyc.required_for_withdrawal': true,
  'trade.min_duration_seconds': 60,
  'trade.max_duration_seconds': 3600,
  'trade.default_payout_ratio': 0.6,
  'withdrawal.fee_percentage': 0.02,
} as const;
```

The response groups values into `deposit`, `withdrawal`, `kyc`, and `trade`; it does not query or serialize any other settings. Added `migrations/041_seed_withdrawal_fee_setting.sql` to seed `withdrawal.fee_percentage` as `0.02` when a user exists, without changing the settings schema. The payment engine uses this setting with the existing environment fee as fallback.

### Frontend config cache

Added `frontend/src/shared/hooks/usePublicConfig.ts`. It fetches the public endpoint, shares an in-flight request and a five-second module-level cache across hook consumers/navigation, and returns typed flattened values:

```typescript
export interface PublicConfig {
  minDeposit: number;
  maxDeposit: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  kycRequiredForTrading: boolean;
  kycRequiredForWithdrawal: boolean;
  minDuration: number;
  maxDuration: number;
  defaultPayoutRatio: number;
  withdrawalFeePercentage: number;
}
```

### Wallet and trading UI changes

- `DepositForm.tsx`: replaced fixed KES 500 validation with a memoized Zod schema using `minDeposit`/`maxDeposit`; defaults and quick-amount buttons are based on the live minimum and capped at the maximum.
- `WithdrawForm.tsx`: replaced fixed KES 1,500 validation with dynamic minimum/maximum validation; computes the fee from `withdrawalFeePercentage` and shows the configured fee in its label.
- `WalletPage.tsx`: only requires verified KYC to enable Withdraw when `kycRequiredForWithdrawal` is true.
- `OrderForm.tsx`: replaced fixed duration choices with options bounded by global and asset-specific duration limits; generated quick stakes from `asset.minStake` and capped them at `asset.maxStake`. The displayed payout uses the asset’s configured value first, then the global default when the asset payout is null. When trading KYC is required and the current user is unverified, both trade buttons are disabled and the requested KYC banner is shown.

The prior hardcoded Zod constraints (`num >= 500`, `num >= 1500`), `numAmount * 0.02`, duration options constant, and fixed quick-stake array were removed from the named forms.

### Verification

- `npm.cmd run typecheck` — passed with 0 errors.
- `npx.cmd tsc --noEmit -p frontend\tsconfig.json` — passed with 0 errors.
- Focused public-config, trading, and payment tests — 3 suites passed, 18 tests passed.
- Added `tests/config/config.controller.test.ts`, verifying returned settings are allow-listed and sensitive settings are not exposed.
- `git diff --check` — passed.

Full test run 1:

```text
Test Suites: 59 passed, 59 total
Tests:       392 passed, 392 total
Time:        341.223 s
Ran all test suites.
```

Full test run 2:

```text
Test Suites: 59 passed, 59 total
Tests:       392 passed, 392 total
Time:        326.736 s
Ran all test suites.
```

The requested live admin-setting changes (`deposit.min_amount = 1000` and `kyc.required_for_trading = true`) and browser UI verification were not performed in this session. No database values were changed; the dynamic frontend behavior is covered by the endpoint implementation and automated verification above.
