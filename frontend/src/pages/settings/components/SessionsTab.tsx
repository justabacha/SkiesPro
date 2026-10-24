import React, { useCallback, useEffect, useState } from 'react';
import { Monitor, RefreshCw, Smartphone } from 'lucide-react';
import { Button, TableEmpty, TableLoading } from '@/shared/components';
import { apiClient } from '@/shared/services/apiClient';
import type { ApiEnvelope } from '../types';

interface UserSession {
  id: string;
  user_agent: string;
  ip_address: string;
  last_seen_at: string;
  created_at: string;
  is_current: boolean;
}

const panelClass =
  'rounded-xl border border-border-light bg-bg-light-secondary p-5 dark:border-border-dark dark:bg-bg-dark-secondary';

export const SessionsTab: React.FC = () => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ApiEnvelope<UserSession[]>>('/api/v1/users/sessions');
      setSessions(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load active sessions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    setError(null);
    try {
      await apiClient.delete(`/api/v1/users/sessions/${encodeURIComponent(sessionId)}`);
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Unable to revoke session.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className={`${panelClass} space-y-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Active sessions</h2>
          <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
            Review devices signed in to your account and revoke sessions you do not recognize.
          </p>
        </div>
        <Button variant="ghost" onClick={() => void loadSessions()} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-light p-3 text-sm text-text-light-primary dark:bg-bg-dark-tertiary dark:text-text-dark-primary"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <TableLoading message="Loading active sessions..." />
      ) : sessions.length === 0 ? (
        <TableEmpty title="No active sessions found." />
      ) : (
        <ul className="divide-y divide-border-light dark:divide-border-dark">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                {session.user_agent.toLowerCase().includes('mobile') ? (
                  <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                ) : (
                  <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                )}
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{session.user_agent}</p>
                  <p className="mt-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                    IP: {session.ip_address}
                  </p>
                  <p className="mt-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
                    Last seen: {new Date(session.last_seen_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {session.is_current ? (
                  <span className="rounded-full bg-bg-light-tertiary px-3 py-1 text-xs font-semibold text-text-light-primary dark:bg-bg-dark-tertiary dark:text-text-dark-primary">
                    Current
                  </span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={revokingId === session.id}
                    disabled={revokingId !== null}
                    onClick={() => void revokeSession(session.id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
