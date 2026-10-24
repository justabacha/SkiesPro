import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import type { SettingsProfile } from '@/pages/settings/types';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  logout: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/shared/services/apiClient', () => ({
  apiClient: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    delete: mocks.delete,
  },
}));

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ logout: mocks.logout, updateUser: vi.fn() }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

const profile: SettingsProfile = {
  id: 'user-1',
  email: 'trader@example.com',
  display_name: 'Trader One',
  phone: '+254700000000',
  avatar_url: null,
  kyc_status: 'verified',
  created_at: '2026-01-01T00:00:00.000Z',
  mfa_enabled: true,
};

const sessions = [
  {
    id: 'session-current',
    user_agent: 'Desktop Browser',
    ip_address: '127.0.0.1',
    last_seen_at: '2026-10-24T10:00:00.000Z',
    created_at: '2026-10-23T10:00:00.000Z',
    is_current: true,
  },
  {
    id: 'session-old',
    user_agent: 'Mobile Browser',
    ip_address: '192.0.2.10',
    last_seen_at: '2026-10-22T10:00:00.000Z',
    created_at: '2026-10-21T10:00:00.000Z',
    is_current: false,
  },
];

const openTab = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

const renderSettingsPage = (initialEntry = '/settings') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SettingsPage />
    </MemoryRouter>
  );

describe('SettingsPage', () => {
  beforeEach(() => {
    mocks.get.mockReset().mockImplementation(async (path: string) => {
      if (path === '/api/v1/users/sessions') return { data: sessions };
      return { data: profile };
    });
    mocks.post.mockReset().mockResolvedValue({ data: { message: 'ok' } });
    mocks.put.mockReset().mockResolvedValue({ data: profile });
    mocks.delete.mockReset().mockResolvedValue({ data: { message: 'ok' } });
    mocks.logout.mockReset().mockResolvedValue(undefined);
    mocks.navigate.mockReset();
  });

  afterEach(() => cleanup());

  it('renders all settings tabs', async () => {
    renderSettingsPage();
    await screen.findByRole('heading', { name: 'Profile' });
    expect(screen.getByRole('button', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Security' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sessions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Danger Zone' })).toBeTruthy();
  });

  it('validates the strict backend password policy before submit', async () => {
    renderSettingsPage();
    await screen.findByRole('heading', { name: 'Profile' });
    openTab('Security');

    fireEvent.change(document.getElementById('current-password')!, {
      target: { value: 'OldPassword1!' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NoSymbol123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'NoSymbol123' },
    });
    expect(screen.getByRole('button', { name: 'Update password' }).hasAttribute('disabled')).toBe(
      true
    );

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'StrongPass1!' },
    });
    expect(screen.getByRole('button', { name: 'Update password' }).hasAttribute('disabled')).toBe(
      false
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => {
      expect(mocks.put).toHaveBeenCalledWith('/api/v1/users/password', {
        current_password: 'OldPassword1!',
        new_password: 'StrongPass1!',
      });
    });
  });

  it('saves profile details through the users profile endpoint', async () => {
    mocks.put.mockResolvedValue({
      data: { ...profile, display_name: 'Updated Trader', phone: '+254711111111' },
    });
    renderSettingsPage();
    await screen.findByRole('heading', { name: 'Profile' });

    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Updated Trader' },
    });
    fireEvent.change(screen.getByLabelText('Phone'), {
      target: { value: '+254711111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(mocks.put).toHaveBeenCalledWith('/api/v1/users/profile', {
        display_name: 'Updated Trader',
        phone: '+254711111111',
      });
    });
    expect((await screen.findByRole('status')).textContent).toContain(
      'Profile updated successfully.'
    );
  });

  it('starts MFA setup with user email as label', async () => {
    const disabledMfaProfile = { ...profile, mfa_enabled: false };
    mocks.get.mockResolvedValue({ data: disabledMfaProfile });
    mocks.post.mockResolvedValue({
      data: { secret: 'SECRET123', qr_code_url: 'data:image/png;base64,qr' },
    });

    renderSettingsPage();
    await screen.findByRole('heading', { name: 'Profile' });
    openTab('Security');

    fireEvent.click(screen.getByRole('button', { name: 'Enable MFA' }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/api/v1/auth/mfa/setup', {
        label: 'trader@example.com',
      });
    });
  });

  it('disables MFA using an authenticator code', async () => {
    renderSettingsPage();
    await screen.findByRole('heading', { name: 'Profile' });
    openTab('Security');
    fireEvent.click(screen.getByRole('button', { name: 'Disable MFA' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm disable' }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/api/v1/auth/mfa/disable', {
        code: '123456',
        password: undefined,
      });
    });
  });

  it('loads sessions and revokes a non-current session', async () => {
    renderSettingsPage();
    await screen.findByRole('heading', { name: 'Profile' });
    openTab('Sessions');
    expect(await screen.findByText('Desktop Browser')).toBeTruthy();
    expect(screen.getByText('Current')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(mocks.delete).toHaveBeenCalledWith('/api/v1/users/sessions/session-old');
    });
    expect(screen.queryByText('Mobile Browser')).toBeNull();
  });
});
