import {
  IPaymentGateway,
  StkPushRequest,
  StkPushResponse,
  TransactionStatusResponse,
} from './IPaymentGateway';
import { v4 as uuidv4 } from 'uuid';

export class MpesaMockAdapter implements IPaymentGateway {
  async initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
    console.log(
      `[MpesaMockAdapter] Initiating STK Push for user ${request.userId}, amount ${request.amount}, phone ${request.phone}`
    );

    // Simulate a successful response from Safaricom
    return {
      merchantRequestId: uuidv4(),
      checkoutRequestId: uuidv4(),
      responseCode: '0',
      responseDescription: 'Success. Request accepted for processing',
      customerMessage: 'Success. Request accepted for processing',
    };
  }

  async queryTransactionStatus(checkoutRequestId: string): Promise<TransactionStatusResponse> {
    console.log(`[MpesaMockAdapter] Querying status for ${checkoutRequestId}`);

    return {
      merchantRequestId: uuidv4(),
      checkoutRequestId: checkoutRequestId,
      resultCode: '0',
      resultDesc: 'The service request is processed successfully.',
    };
  }
}
