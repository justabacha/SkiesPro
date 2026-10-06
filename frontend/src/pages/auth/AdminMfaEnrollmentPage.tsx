import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { apiClient } from '@/shared/services/apiClient';
import { useAuth } from '@/shared/hooks/useAuth';

interface SetupResponse {
  data: {
    secret: string;
    qr_code_url: string;
  };
}

interface ConfirmResponse {
  data: {
    message: string;
    recovery_codes: string[];
  };
}

export const AdminMfaEnrollmentPage = () => {
  const { mfaEnrollmentToken, mfaSetupRequired, clearMfaEnrollment } = useAuth();
  const navigate = useNavigate();
  const [setup, setSetup] = useState<SetupResponse['data'] | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mfaSetupRequired || !mfaEnrollmentToken) return;
    let active = true;
    apiClient
      .post<SetupResponse>(
        '/api/v1/auth/admin-mfa/setup',
        {},
        { headers: { Authorization: `Bearer ${mfaEnrollmentToken}` } }
      )
      .then((response) => {
        if (active) setSetup(response.data);
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mfaSetupRequired, mfaEnrollmentToken]);

  if (!mfaSetupRequired || !mfaEnrollmentToken) {
    return <Navigate to="/login" replace />;
  }

  const confirmSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post<ConfirmResponse>(
        '/api/v1/auth/admin-mfa/verify-setup',
        { totp_code: code },
        { headers: { Authorization: `Bearer ${mfaEnrollmentToken}` } }
      );
      setRecoveryCodes(response.data.recovery_codes);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <section className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-8">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold">Set up administrator MFA</h1>
            <p className="text-sm text-slate-400">TOTP enrollment is required for staff accounts.</p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-4 flex items-center gap-2 text-sm text-rose-400">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        )}

        {loading && !setup ? (
          <p className="text-sm text-slate-400">Preparing your authenticator setup...</p>
        ) : recoveryCodes ? (
          <div className="space-y-5">
            <p className="text-sm text-slate-300">
              MFA is enabled. Save these recovery codes somewhere secure; they will not be shown
              again.
            </p>
            <pre className="grid grid-cols-2 gap-2 rounded bg-slate-950 p-4 font-mono text-sm">
              {recoveryCodes.join('\n')}
            </pre>
            <button
              type="button"
              onClick={() => {
                clearMfaEnrollment();
                navigate('/login', { replace: true });
              }}
              className="w-full rounded bg-amber-500 px-4 py-2 font-semibold text-slate-950"
            >
              Continue to sign in
            </button>
          </div>
        ) : setup ? (
          <div className="space-y-5">
            <p className="text-sm text-slate-300">
              Scan this QR code with your authenticator app, then enter the six-digit code.
            </p>
            <img src={setup.qr_code_url} alt="TOTP enrollment QR code" className="mx-auto h-48 w-48" />
            <p className="break-all rounded bg-slate-950 p-3 text-center font-mono text-sm">
              {setup.secret}
            </p>
            <form onSubmit={confirmSetup} className="space-y-4">
              <label htmlFor="totp-code" className="block text-sm font-medium">
                Authenticator code
              </label>
              <input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-4 py-3 text-center font-mono text-xl tracking-[0.5em]"
                required
              />
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full rounded bg-amber-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify and enable MFA'}
              </button>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
};
