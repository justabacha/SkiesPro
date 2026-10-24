import React, { useState } from 'react';
import { Check, Copy, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button, Input, Modal, PasswordInput } from '@/shared/components';
import { apiClient } from '@/shared/services/apiClient';
import { useAuth } from '@/shared/hooks/useAuth';
import type { ApiEnvelope, SettingsProfile } from '../types';

interface SecurityTabProps {
  profile: SettingsProfile;
  onProfileUpdated: (updates: Partial<SettingsProfile>) => void;
}

interface MfaSetup {
  secret: string;
  qr_code_url: string;
}

const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const panelClass =
  'space-y-5 rounded-xl border border-border-light bg-bg-light-secondary p-5 dark:border-border-dark dark:bg-bg-dark-secondary';
const labelClass =
  'mb-1.5 block text-sm font-medium text-text-light-primary dark:text-text-dark-primary';

const isSettingsPasswordValid = (password: string): boolean =>
  PASSWORD_PATTERN.test(password);

export const SecurityTab: React.FC<SecurityTabProps> = ({ profile, onProfileUpdated }) => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [isMfaSetupOpen, setIsMfaSetupOpen] = useState(false);
  const [isMfaCredentialOpen, setIsMfaCredentialOpen] = useState(false);
  const [credentialPurpose, setCredentialPurpose] = useState<'disable' | 'backup'>('disable');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPassword, setMfaPassword] = useState('');
  const [isMfaBusy, setIsMfaBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [emailStep, setEmailStep] = useState<'initiate' | 'verify'>('initiate');
  const [isEmailBusy, setIsEmailBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const strengthChecks = [
    { label: 'At least 8 characters', valid: newPassword.length >= 8 },
    { label: 'Lowercase and uppercase letters', valid: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) },
    { label: 'At least one number', valid: /\d/.test(newPassword) },
    { label: 'At least one allowed symbol (@$!%*?&)', valid: /[@$!%*?&]/.test(newPassword) },
    { label: 'Only allowed characters', valid: /^[A-Za-z\d@$!%*?&]*$/.test(newPassword) },
  ];
  const passwordValid = isSettingsPasswordValid(newPassword);
  const passwordStrength = strengthChecks.filter((check) => check.valid).length;

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passwordValid || newPassword !== confirmPassword) return;
    setNotice(null);
    setIsChangingPassword(true);
    try {
      await apiClient.put('/api/v1/users/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice({ type: 'success', text: 'Password changed successfully.' });
    } catch (passwordError) {
      setNotice({
        type: 'error',
        text: passwordError instanceof Error ? passwordError.message : 'Unable to change password.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const startMfaSetup = async () => {
    setNotice(null);
    setIsMfaBusy(true);
    const mfaLabel = user?.email || profile.email;
    try {
      const response = await apiClient.post<ApiEnvelope<MfaSetup>>('/api/v1/auth/mfa/setup', {
        label: mfaLabel,
      });
      setMfaSetup(response.data);
      setIsMfaSetupOpen(true);
    } catch (setupError) {
      setNotice({
        type: 'error',
        text: setupError instanceof Error ? setupError.message : 'Unable to start MFA setup.',
      });
    } finally {
      setIsMfaBusy(false);
    }
  };

  const verifyMfaSetup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsMfaBusy(true);
    try {
      const response = await apiClient.post<
        ApiEnvelope<{ message: string; recovery_codes: string[] }>
      >('/api/v1/auth/mfa/verify-setup', { totp_code: mfaCode });
      onProfileUpdated({ mfa_enabled: true });
      setIsMfaSetupOpen(false);
      setMfaCode('');
      setBackupCodes(response.data.recovery_codes || []);
      setNotice({ type: 'success', text: 'Multi-factor authentication enabled.' });
    } catch (verifyError) {
      setNotice({
        type: 'error',
        text: verifyError instanceof Error ? verifyError.message : 'Unable to verify MFA code.',
      });
    } finally {
      setIsMfaBusy(false);
    }
  };

  const openMfaCredential = (purpose: 'disable' | 'backup') => {
    setCredentialPurpose(purpose);
    setMfaCode('');
    setMfaPassword('');
    setIsMfaCredentialOpen(true);
  };

  const submitMfaCredential = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mfaCode.trim() && !mfaPassword) return;
    setIsMfaBusy(true);
    try {
      const body = { code: mfaCode.trim() || undefined, password: mfaPassword || undefined };
      if (credentialPurpose === 'disable') {
        await apiClient.post('/api/v1/auth/mfa/disable', body);
        onProfileUpdated({ mfa_enabled: false });
        setNotice({ type: 'success', text: 'Multi-factor authentication disabled.' });
      } else {
        const response = await apiClient.post<ApiEnvelope<{ backup_codes: string[] }>>(
          '/api/v1/auth/mfa/backup-codes/regenerate',
          body
        );
        setBackupCodes(response.data.backup_codes);
      }
      setIsMfaCredentialOpen(false);
      setMfaCode('');
      setMfaPassword('');
    } catch (mfaError) {
      setNotice({
        type: 'error',
        text: mfaError instanceof Error ? mfaError.message : 'Unable to update MFA settings.',
      });
    } finally {
      setIsMfaBusy(false);
    }
  };

  const initiateEmailChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setIsEmailBusy(true);
    try {
      await apiClient.post('/api/v1/users/email-change/initiate', {
        new_email: email.trim(),
        password: emailPassword,
      });
      setEmailStep('verify');
      setNotice({ type: 'success', text: 'Verification token sent. Enter the token from the email.' });
    } catch (emailError) {
      setNotice({
        type: 'error',
        text: emailError instanceof Error ? emailError.message : 'Unable to initiate email change.',
      });
    } finally {
      setIsEmailBusy(false);
    }
  };

  const verifyEmailChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsEmailBusy(true);
    try {
      await apiClient.post('/api/v1/users/email-change/verify', { token: emailToken.trim() });
      onProfileUpdated({ email: email.trim() });
      setEmailStep('initiate');
      setEmail('');
      setEmailPassword('');
      setEmailToken('');
      setNotice({ type: 'success', text: 'Email address updated successfully.' });
    } catch (emailError) {
      setNotice({
        type: 'error',
        text: emailError instanceof Error ? emailError.message : 'Unable to verify email change.',
      });
    } finally {
      setIsEmailBusy(false);
    }
  };

  const copyBackupCodes = async () => {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (copyError) {
      setNotice({
        type: 'error',
        text: copyError instanceof Error ? copyError.message : 'Unable to copy backup codes.',
      });
    }
  };

  return (
    <div className="space-y-5">
      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border border-border-light p-3 text-sm dark:border-border-dark ${
            notice.type === 'error'
              ? 'bg-danger-light text-text-light-primary dark:bg-bg-dark-secondary dark:text-text-dark-primary'
              : 'bg-success-light text-text-light-primary dark:bg-bg-dark-secondary dark:text-text-dark-primary'
          }`}
        >
          {notice.text}
        </div>
      )}

      <section className={panelClass}>
        <div>
          <h2 className="text-lg font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Use a unique password that meets all listed requirements.
          </p>
        </div>
        <form onSubmit={changePassword} className="grid gap-4 md:max-w-xl">
          <div>
            <label className={labelClass} htmlFor="current-password">
              Current password
            </label>
            <PasswordInput id="current-password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-password">
              New password
            </label>
            <PasswordInput id="new-password" autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} aria-describedby="password-strength" />
            <div id="password-strength" className="mt-3 space-y-2" aria-live="polite">
              <div className="flex gap-1" aria-label={`Password strength ${passwordStrength} of 5`}>
                {strengthChecks.map((check) => (
                  <span
                    key={check.label}
                    className={`h-1.5 flex-1 rounded-full ${
                      check.valid
                        ? 'bg-success'
                        : 'bg-bg-light-tertiary dark:bg-bg-dark-tertiary'
                    }`}
                  />
                ))}
              </div>
              <ul className="grid gap-1 text-xs text-text-light-secondary dark:text-text-dark-secondary sm:grid-cols-2">
                {strengthChecks.map((check) => (
                  <li key={check.label} className="flex items-center gap-1.5">
                    <Check
                      aria-hidden="true"
                      className={`h-3.5 w-3.5 ${check.valid ? 'text-success' : 'text-text-light-tertiary dark:text-text-dark-tertiary'}`}
                    />
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="confirm-password">
              Confirm new password
            </label>
            <PasswordInput id="confirm-password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="mt-1 text-xs text-danger">Passwords do not match.</p>
            )}
          </div>
          <div>
            <Button
              type="submit"
              isLoading={isChangingPassword}
              disabled={!currentPassword || !passwordValid || newPassword !== confirmPassword}
            >
              Update password
            </Button>
          </div>
        </form>
      </section>

      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Multi-factor authentication</h2>
            <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
              {profile.mfa_enabled
                ? 'An authenticator app is protecting your account.'
                : 'Add an authenticator app as an extra layer of security.'}
            </p>
          </div>
          {profile.mfa_enabled ? (
            <Button variant="danger" onClick={() => openMfaCredential('disable')}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Disable MFA
            </Button>
          ) : (
            <Button isLoading={isMfaBusy} onClick={startMfaSetup}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Enable MFA
            </Button>
          )}
        </div>
        {profile.mfa_enabled && (
          <Button variant="secondary" onClick={() => openMfaCredential('backup')}>
            Regenerate backup codes
          </Button>
        )}
      </section>

      <section className={panelClass}>
        <div>
          <h2 className="text-lg font-semibold">Change email</h2>
          <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Confirm the new address using the verification token sent to you.
          </p>
        </div>
        {emailStep === 'initiate' ? (
          <form onSubmit={initiateEmailChange} className="grid gap-4 md:max-w-xl">
            <div>
              <label className={labelClass} htmlFor="new-email">
                New email address
              </label>
              <Input id="new-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="email-current-password">
                Current password
              </label>
              <PasswordInput id="email-current-password" autoComplete="current-password" required value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} />
            </div>
            <Button type="submit" isLoading={isEmailBusy}>
              Send verification
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyEmailChange} className="grid gap-4 md:max-w-xl">
            <label className={labelClass} htmlFor="email-change-token">
              Email verification token
            </label>
            <Input
              id="email-change-token"
              required
              autoComplete="one-time-code"
              value={emailToken}
              onChange={(event) => setEmailToken(event.target.value)}
              aria-describedby="email-token-help"
            />
            <p id="email-token-help" className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
              Paste the verification token from the email. It is not a six-digit code.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" isLoading={isEmailBusy}>
                Verify email
              </Button>
              <Button variant="ghost" onClick={() => setEmailStep('initiate')}>
                Start over
              </Button>
            </div>
          </form>
        )}
      </section>

      <Modal
        isOpen={isMfaSetupOpen}
        onClose={() => setIsMfaSetupOpen(false)}
        title="Set up multi-factor authentication"
      >
        <div className="space-y-4">
          {mfaSetup?.qr_code_url && (
            <img
              src={mfaSetup.qr_code_url}
              alt="Scan this QR code with your authenticator app"
              className="mx-auto h-48 w-48 rounded-lg border border-border-light bg-bg-light-primary p-2 dark:border-border-dark dark:bg-bg-dark-primary"
            />
          )}
          <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Scan the QR code or enter this setup key manually.
          </p>
          <code className="block break-all rounded-lg bg-bg-light-tertiary p-3 text-sm dark:bg-bg-dark-tertiary">
            {mfaSetup?.secret}
          </code>
          <form onSubmit={verifyMfaSetup} className="space-y-3">
            <label className={labelClass} htmlFor="mfa-setup-code">
              6-digit authenticator code
            </label>
            <Input
              id="mfa-setup-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
            />
            <Button type="submit" isLoading={isMfaBusy} disabled={!/^\d{6}$/.test(mfaCode)}>
              Verify and enable
            </Button>
          </form>
        </div>
      </Modal>

      <Modal
        isOpen={isMfaCredentialOpen}
        onClose={() => setIsMfaCredentialOpen(false)}
        title={credentialPurpose === 'disable' ? 'Disable MFA' : 'Regenerate backup codes'}
      >
        <form onSubmit={submitMfaCredential} className="space-y-4">
          <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Confirm with an authenticator code or your password.
          </p>
          <div>
            <label className={labelClass} htmlFor="mfa-confirm-code">
              Authenticator code
            </label>
            <Input
              id="mfa-confirm-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="mfa-confirm-password">
              Password
            </label>
            <PasswordInput
              id="mfa-confirm-password"
              autoComplete="current-password"
              value={mfaPassword}
              onChange={(event) => setMfaPassword(event.target.value)}
            />
          </div>
          <Button type="submit" isLoading={isMfaBusy} disabled={!mfaCode.trim() && !mfaPassword}>
            {credentialPurpose === 'disable' ? 'Confirm disable' : 'Regenerate codes'}
          </Button>
        </form>
      </Modal>

      <Modal
        isOpen={backupCodes !== null}
        onClose={() => setBackupCodes(null)}
        title="Save your backup codes"
        closeOnClickOutside={false}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Store these codes somewhere safe. Each code can only be used once.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded-lg bg-bg-light-tertiary p-4 font-mono text-sm dark:bg-bg-dark-tertiary">
            {backupCodes?.map((code) => <li key={code}>{code}</li>)}
          </ul>
          <Button variant="secondary" onClick={copyBackupCodes}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? 'Copied' : 'Copy codes'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};
