import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WithdrawForm } from '@/pages/wallet/components/WithdrawForm';

const mockRequestWithdrawal = vi.fn();
let mockUser: { phone?: string | null } | null = { phone: '0712345678' };

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('@/shared/hooks/useWallet', () => ({
  useWallet: () => ({ requestWithdrawal: mockRequestWithdrawal }),
}));

vi.mock('@/shared/hooks/usePublicConfig', () => ({
  usePublicConfig: () => ({
    minWithdrawal: 100,
    maxWithdrawal: 70000,
    withdrawalFeePercentage: 0.01,
  }),
}));

vi.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn(), setTheme: vi.fn() }),
}));

describe('WithdrawForm', () => {
  beforeEach(() => {
    mockRequestWithdrawal.mockReset();
    mockUser = { phone: '0712345678' };
  });

  afterEach(() => cleanup());

  it('displays read-only phone number and submits withdrawal with normalized phone when phone exists', async () => {
    mockRequestWithdrawal.mockResolvedValue({ success: true });

    render(<WithdrawForm availableBalance="5000" onSuccess={vi.fn()} />);

    expect(screen.getByText('0712345678')).toBeTruthy();
    expect(screen.getByAltText('IntaSend Secure Payments (PCI-DSS Compliant)')).toBeTruthy();

    const amountInput = screen.getByPlaceholderText('KES 100–70000');
    fireEvent.change(amountInput, { target: { value: '500' } });

    const submitBtn = screen.getByRole('button', { name: 'Request Withdrawal' });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRequestWithdrawal).toHaveBeenCalledWith({
        amount: '500',
        phone: '254712345678',
      });
    });
  });

  it('displays update profile warning and disables submission when user phone is missing', async () => {
    mockUser = { phone: null };

    render(<WithdrawForm availableBalance="5000" onSuccess={vi.fn()} />);

    expect(screen.getByText(/No M-Pesa number registered/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Update Profile' })).toBeTruthy();

    const submitBtn = screen.getByRole('button', { name: 'Request Withdrawal' });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });
});
