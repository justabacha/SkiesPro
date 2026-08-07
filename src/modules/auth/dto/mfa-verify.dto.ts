export interface MfaVerifyDto {
  mfa_session_token: string;
  totp_code: string;
}

export interface MfaSetupResponseDto {
  secret: string;
  qr_code_url: string;
  setup_completed: false;
}
