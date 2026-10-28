import { Decimal } from 'decimal.js';

export interface B2CPayoutRequest {
  originatorConversationId: string; // internal UUID for idempotency (mapped to Daraja OriginatorConversationID)
  amount: Decimal; // payout amount (will be net_amount from caller)
  recipientPhone: string; // user's M-Pesa MSISDN
  remarks: string;
  occasion?: string;
}

export interface B2CPayoutResponse {
  conversationId: string; // Daraja's ConversationID
  originatorConversationId: string; // echoed
  responseCode: string; // "0" = accepted by Daraja (async result follows)
  responseDescription: string;
  raw: unknown;
}

export interface B2CStatusResponse {
  conversationId: string;
  status: 'completed' | 'failed' | 'pending';
  resultCode?: number;
  resultDescription?: string;
  transactionAmount?: Decimal;
  raw: unknown;
}

export interface IB2CPayoutGateway {
  initiateB2CPayout(req: B2CPayoutRequest): Promise<B2CPayoutResponse>;
  queryB2CStatus(conversationId: string): Promise<B2CStatusResponse>;
}

export class B2CPayoutError extends Error {
  public readonly code?: string | number;
  public readonly raw?: unknown;
  public readonly outcome?: 'definitely_not_sent' | 'possibly_sent' | 'server_rejected';

  constructor(
    message: string,
    code?: string | number,
    raw?: unknown,
    outcome?: 'definitely_not_sent' | 'possibly_sent' | 'server_rejected'
  ) {
    super(message);
    this.name = 'B2CPayoutError';
    this.code = code;
    this.raw = raw;
    this.outcome = outcome;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
