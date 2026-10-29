# Frontend UI Polish & IntaSend Integration Audit Report

**Date:** February 2025  
**Scope:** Read-Only Audit of Frontend Wallet, Theme Architecture, User Profile Data, and Withdrawal Components  
**Status:** Complete  

---

## Executive Summary
This report maps out the current frontend architecture of the SkiesPro application to prepare for three targeted UI polish enhancements:
1. Integrating IntaSend Trust Badges with dynamic light/dark theme switching into payment forms (Deposit & Withdrawal).
2. Removing the manual phone number input from the Withdrawal form and replacing it with a read-only display of the user's registered profile phone.
3. Ensuring existing shared UI primitives and state mechanisms are ready to support these injections.

---

## 1. Component Mapping

The wallet and payment interface is located within `frontend/src/pages/wallet/`.

| Component / Layer | File Path | Line Count | Description / Role |
| :--- | :--- | :--- | :--- |
| **Wallet Page (Parent)** | `frontend/src/pages/wallet/WalletPage.tsx` | 181 lines | Parent view managing balance, transaction history, and modal triggers for Deposit and Withdraw forms (Lines 145–172). |
| **Deposit Component** | `frontend/src/pages/wallet/components/DepositForm.tsx` | 159 lines | Renders deposit amount selection, M-Pesa phone number input, and initiates STK push via `useWallet().initiateDeposit`. |
| **Withdrawal Component** | `frontend/src/pages/wallet/components/WithdrawForm.tsx` | 165 lines | Renders withdrawal amount, processing fee calculation, M-Pesa phone number input, and payout request via `useWallet().requestWithdrawal`. |
| **Transaction History** | `frontend/src/pages/wallet/components/TransactionHistory.tsx` | 214 lines | Displays immutable ledger entries in a tabbed table view. |

### Shared UI Components (`frontend/src/shared/components/`)
All form inputs, buttons, containers, and cards rely on a unified set of shared UI primitives exported from `frontend/src/shared/components/index.ts`:

- **Card (`Card.tsx`, 30 lines):** Container element supporting `default`, `stat`, `asset`, `contract`, and `kyc` variants with Tailwind dark mode styles.
- **Button (`Button.tsx`, 63 lines):** Primitive button with loading state support (`isLoading`), sizes (`sm`, `md`, `lg`, `icon`), and variants (`primary`, `secondary`, `ghost`, `danger`, `buy-up`, `buy-down`).
- **Input (`Input.tsx`, 32 lines):** Styled HTML input element with error state outline support.
- **PhoneInput (`PhoneInput.tsx`, 30 lines):** Input wrapper with a fixed `+254` prefix overlay.
- **FormGroup (`FormGroup.tsx`, 47 lines):** Wrapper supplying field labels, required markers (`*`), error messages, and helper hint text.
- **Stack (`Stack.tsx`, 73 lines):** Flex layout wrapper supporting standard gap spacing and alignment.
- **Modal (`Modal.tsx`, 95 lines):** Dialog modal backdrop and container used by `WalletPage` to display forms.

---

## 2. Theme Architecture

### Light vs. Dark Mode Mechanism
Dark mode is implemented using Tailwind CSS's class strategy (`darkMode: 'class'` in `frontend/tailwind.config.js`). Theme state is managed via React Context and persisted in `localStorage`.

- **Theme Context:** `frontend/src/shared/context/ThemeContext.tsx` (53 lines)
- **Custom Hook:** `frontend/src/shared/hooks/useTheme.ts` (4 lines)
- **Configuration:** `frontend/tailwind.config.js` (105 lines)

#### Theme Context Code Implementation (`frontend/src/shared/context/ThemeContext.tsx`):
```tsx
type Theme = 'light' | 'dark';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as Theme;
      if (savedTheme) return savedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ...
};
```

#### Detecting Theme in Components
To conditionally render the correct IntaSend trust badge asset (`light` vs. `dark` variant), components consume `useTheme()`:

```tsx
import { useTheme } from '@/shared/hooks/useTheme';

const BadgeComponent = () => {
  const { theme } = useTheme(); // returns 'light' | 'dark'
  const badgeSrc = theme === 'dark' 
    ? '/assets/intasend-trust-badge-dark.svg' 
    : '/assets/intasend-trust-badge-light.svg';

  return <img src={badgeSrc} alt="IntaSend Secured" className="h-8 auto" />;
};
```

---

## 3. User Profile Data (Phone Number Analysis)

### State Management & Access
The application manages authentication and global user state through React Context in `AuthContext.tsx`.

- **Auth Context:** `frontend/src/shared/context/AuthContext.tsx` (420 lines)
- **Auth Hook:** `frontend/src/shared/hooks/useAuth.ts` (6 lines)
- **Profile Endpoint:** `/api/v1/auth/me` and `/api/v1/users/profile`

#### Hook Used to Access User Data:
```tsx
import { useAuth } from '@/shared/hooks/useAuth';

const { user } = useAuth();
```

#### Gap Analysis & Required State Preparation
1. **Backend Capability:** The backend endpoint `GET /api/v1/auth/me` (`src/modules/auth/services/authService.ts#L206`) returns `phone: user.phone` in its payload.
2. **Current Frontend Interface:** In `frontend/src/shared/context/AuthContext.tsx` (Lines 4–13), the `User` interface is currently defined as:
   ```ts
   interface User {
     id: string;
     email: string;
     displayName: string;
     role: string;
     roles: string[];
     kycStatus: string;
     mfaEnabled: boolean;
     avatarUrl?: string | null;
   }
   ```
3. **Required Update:** To allow `WithdrawForm` (or any other component) to access the user's profile phone number directly from `useAuth()`, `User` interface in `AuthContext.tsx` must be updated to include `phone?: string | null`, and `mapUserResponse()` in `AuthContext.tsx` must map `phone: userData.phone || null`.

---

## 4. Withdrawal Form Analysis

### Current Implementation (`frontend/src/pages/wallet/components/WithdrawForm.tsx`)

#### Full JSX/TSX Source Code:
```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Input,
  FormGroup,
  Stack,
  PhoneInput,
} from '@/shared/components';
import { useWallet } from '@/shared/hooks/useWallet';
import { usePublicConfig } from '@/shared/hooks/usePublicConfig';
import { formatKES } from '@/shared/utils/currencyUtils';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

const createWithdrawSchema = (min: number, max: number) =>
  z.object({
    amount: z.string().refine((value) => {
      const amount = Number(value);
      return Number.isFinite(amount) && amount >= min && amount <= max;
    }, { message: `Withdrawal amount must be between KES ${min} and KES ${max}` }),
    phone: z.string().regex(/^(?:254|\+254|0)?([71][0-9]{8})$/, {
      message: 'Please enter a valid Safaricom phone number',
    }),
  });

interface WithdrawFormProps {
  availableBalance: string;
  onSuccess: () => void;
}

export const WithdrawForm: React.FC<WithdrawFormProps> = ({ availableBalance, onSuccess }) => {
  const { requestWithdrawal } = useWallet({ accountMode: 'real' });
  const config = usePublicConfig();
  const [status, setState] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setError] = useState<string | null>(null);
  const withdrawSchema = useMemo(
    () => createWithdrawSchema(config.minWithdrawal, config.maxWithdrawal),
    [config.minWithdrawal, config.maxWithdrawal]
  );
  type WithdrawInput = z.infer<typeof withdrawSchema>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WithdrawInput>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      amount: String(config.minWithdrawal),
    }
  });
  useEffect(() => {
    setValue('amount', String(config.minWithdrawal), { shouldValidate: true });
  }, [config.minWithdrawal, setValue]);

  const amount = useWatch({ control, name: 'amount' });
  const numAmount = parseFloat(amount) || 0;
  const fee = numAmount * config.withdrawalFeePercentage;
  const netAmount = numAmount - fee;

  const onSubmit = async (data: WithdrawInput) => {
    if (parseFloat(data.amount) > parseFloat(availableBalance)) {
      setError('Insufficient available balance');
      setState('error');
      return;
    }

    setState('idle');
    setError(null);
    try {
      const normalizedPhone = data.phone.replace(/^\+/, '').replace(/^0/, '254');
      await requestWithdrawal({
        amount: data.amount,
        phone: normalizedPhone.startsWith('254') ? normalizedPhone : `254${normalizedPhone}`
      });
      setState('success');
      setTimeout(onSuccess, 3000);
    } catch (err) {
      setError((err as Error).message);
      setState('error');
    }
  };

  if (status === 'success') {
    return (
      <Stack align="center" gap="md" className="py-8">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <h3 className="text-xl font-bold">Request Submitted</h3>
        <p className="text-center text-text-light-secondary dark:text-text-dark-secondary">
          Your withdrawal request has been received and is being processed.
        </p>
      </Stack>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack gap="lg">
        {status === 'error' && (
          <div className="p-3 rounded-md bg-danger-light border border-danger/20 flex items-center gap-2 text-danger text-sm">
            <AlertCircle className="h-4 w-4" />
            {errorMsg}
          </div>
        )}

        <div className="p-4 rounded-md bg-bg-light-tertiary dark:bg-bg-dark-tertiary border border-border-light dark:border-border-dark">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-text-light-tertiary uppercase font-bold">Available for Withdrawal</span>
            <span className="text-sm font-mono font-bold text-success">{formatKES(availableBalance)}</span>
          </div>
        </div>

        <FormGroup label="Withdrawal Amount (KES)" error={errors.amount?.message}>
          <Input
            {...register('amount')}
            type="number"
            placeholder={`KES ${config.minWithdrawal}–${config.maxWithdrawal}`}
            className="font-mono"
            error={!!errors.amount}
          />
        </FormGroup>

        <FormGroup label="Receiving M-Pesa Number" error={errors.phone?.message}>
          <PhoneInput
            {...register('phone')}
            placeholder="0712345678"
            error={!!errors.phone}
          />
        </FormGroup>

        <div className="space-y-2 p-3 bg-bg-light-secondary dark:bg-bg-dark-secondary rounded border border-border-light dark:border-border-dark">
          <div className="flex justify-between text-xs">
            <span className="text-text-light-tertiary">
              Processing Fee ({(config.withdrawalFeePercentage * 100).toFixed(2)}%)
            </span>
            <span className="font-mono">{formatKES(fee)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-border-light dark:border-border-dark pt-2">
            <span>Net Payout</span>
            <span className="font-mono">{formatKES(netAmount)}</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-md bg-info-light border border-info/20 text-info text-[10px]">
          <Info className="h-3 w-3 shrink-0 mt-0.5" />
          <p>Withdrawals to M-Pesa are usually processed within 2 hours. Large amounts may require manual review.</p>
        </div>

        <Button
          type="submit"
          className="w-full h-12"
          isLoading={isSubmitting}
          disabled={numAmount > parseFloat(availableBalance)}
        >
          Request Withdrawal
        </Button>
      </Stack>
    </form>
  );
};
```

### Targeted Field & Validation Mapping
1. **Interactive Field:** Lines 123–129 render an editable `<PhoneInput>` registered with react-hook-form as `'phone'`.
2. **Form Schema Validation:** `createWithdrawSchema` enforces a regex constraint `^(?:254|\+254|0)?([71][0-9]{8})$`.
3. **Submit Logic:** Lines 64–68 perform client-side phone normalization before invoking `requestWithdrawal({ amount, phone })`.
4. **Refactoring Plan for Withdrawal Form:**
   - Remove `phone` from the Zod validation schema.
   - Replace the interactive `PhoneInput` with a read-only container displaying the user's verified profile phone number (retrieved via `useAuth().user?.phone`).
   - If the user's phone is missing from their profile, display an action prompt directing them to the Profile Settings page (`/settings?tab=profile`) to register their M-Pesa phone before requesting a payout.
   - Pass the profile phone directly to `requestWithdrawal()`.

---

## 5. Styling Framework

The application uses **Tailwind CSS** with helper utilities `clsx` and `tailwind-merge` (`cn()`) for dynamic class composition. Design tokens for background, borders, text, status indicators, typography, and spacing are defined in `frontend/tailwind.config.js`.

### Shared Component Styling Examples

#### Card (`frontend/src/shared/components/Card.tsx`)
```tsx
const variants = {
  default: 'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-sm',
  stat: 'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-sm min-w-[220px] min-h-[100px]',
  asset:
    'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-sm border border-border-light dark:border-border-dark',
  contract:
    'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-sm border border-border-light dark:border-border-dark p-3',
  kyc: 'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-md p-6 max-w-[480px]',
};
```

#### Button (`frontend/src/shared/components/Button.tsx`)
```tsx
const variants = {
  primary: 'bg-brand text-white hover:bg-brand-hover active:scale-[0.98]',
  secondary: 'border border-brand text-brand hover:bg-brand-light active:scale-[0.98]',
  ghost:
    'text-brand hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary active:scale-[0.98]',
  danger: 'bg-danger text-white hover:bg-danger/90 active:scale-[0.98]',
  'buy-up':
    'bg-success text-white hover:bg-success/90 active:scale-[0.97] text-lg font-bold h-[48px]',
  'buy-down':
    'bg-danger text-white hover:bg-danger/90 active:scale-[0.97] text-lg font-bold h-[48px]',
};
```

---

## Summary of Actionable Implementation Steps

1. **Update `AuthContext` User Model:** Add `phone?: string | null` to `User` interface and map it in `mapUserResponse` in `AuthContext.tsx`.
2. **Refactor `WithdrawForm` Component:** Replace editable `PhoneInput` with read-only profile phone view, handling missing phone cases gracefully.
3. **Inject IntaSend Trust Badges:** Create a reusable `IntaSendTrustBadge` component consuming `useTheme()` to automatically switch between light and dark SVG badges, and place it at the footer of both `DepositForm` and `WithdrawForm`.

---

FRONTEND AUDIT COMPLETE — NO SOURCE CHANGES MADE
