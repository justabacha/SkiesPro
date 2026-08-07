export interface RegisterDto {
  email: string;
  password: string;
  display_name: string;
  phone?: string;
  referral_code?: string;
}

export interface UserResponseDto {
  id: string;
  email: string;
  display_name: string;
  status: string;
  kyc_status: string;
  mfa_enabled: boolean;
  created_at: string;
}
