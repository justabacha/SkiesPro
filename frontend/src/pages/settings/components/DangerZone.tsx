import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, PasswordInput } from '@/shared/components';
import { useAuth } from '@/shared/hooks/useAuth';
import { apiClient } from '@/shared/services/apiClient';

export const DangerZone: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deactivate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/api/v1/users/deactivate', { password });
      await logout();
      navigate('/login', { replace: true });
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'Unable to deactivate the account.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="space-y-4 rounded-xl border border-danger/40 bg-bg-light-secondary p-5 dark:bg-bg-dark-secondary">
        <div>
          <h2 className="text-lg font-semibold">Danger Zone</h2>
          <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Deactivating your account closes access and signs out all active sessions.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border-light p-4 dark:border-border-dark">
          <div>
            <h3 className="font-semibold">Deactivate Account</h3>
            <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              This action cannot be undone from Settings.
            </p>
          </div>
          <Button variant="danger" onClick={() => setIsOpen(true)}>
            Deactivate account
          </Button>
        </div>
      </section>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Deactivate account">
        <form onSubmit={deactivate} className="space-y-4">
          <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Confirm your password to permanently deactivate this account.
          </p>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger-light p-3 text-sm text-text-light-primary dark:bg-bg-dark-tertiary dark:text-text-dark-primary"
            >
              {error}
            </div>
          )}
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-text-light-primary dark:text-text-dark-primary"
              htmlFor="deactivation-password"
            >
              Password
            </label>
            <PasswordInput
              id="deactivation-password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isSubmitting}>
              Confirm deactivation
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
