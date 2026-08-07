export interface ForgotPwDto {
  email: string;
}

export interface ResetPwDto {
  token: string;
  new_password: string;
}
