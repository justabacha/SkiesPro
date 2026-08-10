export interface ProfileResponseDto {
  id: string;
  email: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  kyc_status: string;
  created_at: string;
}
