export interface StkPushRequest {
  userId: string;
  amount: number;
  phone: string;
  idempotencyKey: string;
}

export interface StkPushResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export interface TransactionStatusResponse {
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: string;
  resultDesc: string;
}

export interface IPaymentGateway {
  initiateStkPush(request: StkPushRequest): Promise<StkPushResponse>;
  queryTransactionStatus(checkoutRequestId: string): Promise<TransactionStatusResponse>;
}
