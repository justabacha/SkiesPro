import {
  IPaymentGateway,
  StkPushRequest,
  StkPushResponse,
  TransactionStatusResponse,
} from './IPaymentGateway.js';
import { v4 as uuidv4 } from 'uuid';

export class MpesaMockAdapter implements IPaymentGateway {
  async initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
    const mockRef = `ws_CO_${Date.now()}`;
    console.log(
      `[MpesaMockAdapter] Initiating STK Push for user ${request.userId}, amount ${request.amount}, phone ${request.phone}. Ref: ${mockRef}`
    );

    return {
      merchantRequestId: uuidv4(),
      checkoutRequestId: mockRef,
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Success. Request accepted for processing',
    };
  }

  async queryTransactionStatus(checkoutRequestId: string): Promise<TransactionStatusResponse> {
    console.log(`[MpesaMockAdapter] Auto-approving status for ${checkoutRequestId}`);

    return {
      merchantRequestId: uuidv4(),
      checkoutRequestId: checkoutRequestId,
      resultCode: '0',
      resultDesc: 'The service request is processed successfully.',
    };
  }
}
