export interface SettingsProfile {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  kyc_status: string;
  created_at: string;
  mfa_enabled: boolean;
}

export interface ApiEnvelope<T> {
  data: T;
}
