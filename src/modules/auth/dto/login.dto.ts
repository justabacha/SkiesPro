export interface LoginDto {
  email: string;
  password: string;
}

export interface MfaRequiredDto {
  requires_mfa: true;
  mfa_session_token: string;
}
