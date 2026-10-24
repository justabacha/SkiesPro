import React, { useEffect, useState } from 'react';
import { FilterTabs, TableLoading } from '@/shared/components';
import { apiClient } from '@/shared/services/apiClient';
import { ProfileTab } from './components/ProfileTab';
import { SecurityTab } from './components/SecurityTab';
import { SessionsTab } from './components/SessionsTab';
import { DangerZone } from './components/DangerZone';
import type { ApiEnvelope, SettingsProfile } from './types';

const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'danger', label: 'Danger Zone' },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]['id'];

export const SettingsPage: React.FC = () => {
  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get<ApiEnvelope<SettingsProfile>>('/api/v1/users/profile')
      .then((response) => {
        if (isMounted) setProfile(response.data);
      })
      .catch((requestError: unknown) => {
        if (isMounted) {
          setError(
            requestError instanceof Error ? requestError.message : 'Unable to load settings.'
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateProfile = (updates: Partial<SettingsProfile>) => {
    setProfile((current) => (current ? { ...current, ...updates } : current));
  };

  return (
    <main className="min-h-full space-y-6 bg-bg-light-primary p-4 text-text-light-primary transition-colors dark:bg-bg-dark-primary dark:text-text-dark-primary sm:p-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
          Manage your profile, security, and account access.
        </p>
      </header>

      <FilterTabs
        tabs={SETTINGS_TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="pills-themed"
        className="flex-wrap"
      />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-light p-4 text-sm text-text-light-primary dark:bg-bg-dark-secondary dark:text-text-dark-primary"
        >
          Unable to load profile settings: {error}
        </div>
      )}

      {isLoading ? (
        <TableLoading message="Loading settings..." />
      ) : profile ? (
        <>
          {activeTab === 'profile' && (
            <ProfileTab profile={profile} onProfileUpdated={updateProfile} />
          )}
          {activeTab === 'security' && (
            <SecurityTab profile={profile} onProfileUpdated={updateProfile} />
          )}
          {activeTab === 'sessions' && <SessionsTab />}
          {activeTab === 'danger' && <DangerZone />}
        </>
      ) : null}
    </main>
  );
};
