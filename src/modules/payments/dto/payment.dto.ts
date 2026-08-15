export interface DepositInitiateDto {
  amount: string;
  currency: string;
  gateway_id: number;
  phone?: string;
  phoneNumber?: string;
}

export interface DepositResponseDto {
  id: string;
  status: string;
  amount: string;
  currency: string;
  gateway_reference: string;
}

export interface WithdrawRequestDto {
  amount: string;
  currency: string;
  gateway_id: number;
  phone: string;
}

export interface WithdrawResponseDto {
  id: string;
  status: string;
  amount: string;
  fee: string;
  net_amount: string;
  currency: string;
}
