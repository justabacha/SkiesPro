export interface TokenResponseDto {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    display_name: string;
    role: string;
    kyc_status: string;
  };
}
