import React, { useState } from 'react';
import { Camera, Save } from 'lucide-react';
import { Button, Input } from '@/shared/components';
import { apiClient } from '@/shared/services/apiClient';
import { useAuth } from '@/shared/hooks/useAuth';
import type { ApiEnvelope, SettingsProfile } from '../types';

interface ProfileTabProps {
  profile: SettingsProfile;
  onProfileUpdated: (updates: Partial<SettingsProfile>) => void;
}

const panelClass =
  'space-y-5 rounded-xl border border-border-light bg-bg-light-secondary p-5 dark:border-border-dark dark:bg-bg-dark-secondary';
const labelClass =
  'mb-1.5 block text-sm font-medium text-text-light-primary dark:text-text-dark-primary';

export const ProfileTab: React.FC<ProfileTabProps> = ({ profile, onProfileUpdated }) => {
  const { updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [phone, setPhone] = useState(profile.phone || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setIsSaving(true);
    try {
      const response = await apiClient.put<ApiEnvelope<SettingsProfile>>(
        '/api/v1/users/profile',
        { display_name: displayName.trim(), phone: phone.trim() || null }
      );
      onProfileUpdated(response.data);
      updateUser({ displayName: response.data.display_name });
      setDisplayName(response.data.display_name);
      setPhone(response.data.phone || '');
      setNotice({ type: 'success', text: 'Profile updated successfully.' });
    } catch (saveError) {
      setNotice({
        type: 'error',
        text: saveError instanceof Error ? saveError.message : 'Unable to update profile.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setNotice({ type: 'error', text: 'Choose a JPEG or PNG image.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice({ type: 'error', text: 'Avatar images must be 2 MB or smaller.' });
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    setNotice(null);
    setIsUploading(true);
    try {
      const response = await apiClient.post<ApiEnvelope<{ avatar_url: string }>>(
        '/api/v1/users/profile/avatar',
        formData
      );
      onProfileUpdated({ avatar_url: response.data.avatar_url });
      updateUser({ avatarUrl: response.data.avatar_url });
      setNotice({ type: 'success', text: 'Avatar uploaded successfully.' });
    } catch (uploadError) {
      setNotice({
        type: 'error',
        text: uploadError instanceof Error ? uploadError.message : 'Unable to upload avatar.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className={panelClass}>
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-text-light-secondary dark:text-text-dark-secondary">
          Update the details associated with your account.
        </p>
      </div>

      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border border-border-light p-3 text-sm dark:border-border-dark ${
            notice.type === 'error'
              ? 'bg-danger-light text-text-light-primary dark:bg-bg-dark-tertiary dark:text-text-dark-primary'
              : 'bg-success-light text-text-light-primary dark:bg-bg-dark-tertiary dark:text-text-dark-primary'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Profile avatar"
            className="h-16 w-16 rounded-full border border-border-light object-cover dark:border-border-dark"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-light-tertiary text-lg font-semibold text-text-light-secondary dark:bg-bg-dark-tertiary dark:text-text-dark-secondary">
            {profile.display_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-light bg-bg-light-primary px-4 py-2 text-sm font-medium hover:bg-bg-light-tertiary dark:border-border-dark dark:bg-bg-dark-primary dark:hover:bg-bg-dark-tertiary">
          <Camera className="h-4 w-4" />
          {isUploading ? 'Uploading...' : 'Upload avatar'}
          <input
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            disabled={isUploading}
            onChange={uploadAvatar}
          />
        </label>
        <span className="text-xs text-text-light-secondary dark:text-text-dark-secondary">
          JPEG or PNG, up to 2 MB.
        </span>
      </div>

      <form onSubmit={saveProfile} className="grid gap-4 md:max-w-2xl">
        <div>
          <label className={labelClass} htmlFor="settings-email">
            Email
          </label>
          <Input id="settings-email" type="email" value={profile.email} readOnly disabled />
          <p className="mt-1 text-xs text-text-light-secondary dark:text-text-dark-secondary">
            Change your email from the Security tab.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="settings-display-name">
            Display name
          </label>
          <Input
            id="settings-display-name"
            autoComplete="name"
            required
            maxLength={80}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="settings-phone">
            Phone
          </label>
          <Input
            id="settings-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div>
          <Button type="submit" isLoading={isSaving} disabled={!displayName.trim()}>
            <Save className="mr-2 h-4 w-4" />
            Save profile
          </Button>
        </div>
      </form>
    </section>
  );
};
