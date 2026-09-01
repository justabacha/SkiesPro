import { IPaymentGateway } from './IPaymentGateway.js';
import { MpesaMockAdapter } from './MpesaMockAdapter.js';
import { DarajaMpesaAdapter } from './DarajaMpesaAdapter.js';

export class MpesaGatewayFactory {
  static getGateway(): IPaymentGateway {
    const mode = process.env.PAYMENT_GATEWAY_MODE || 'MOCK';

    if (mode === 'DARAJA') {
      return new DarajaMpesaAdapter();
    }

    return new MpesaMockAdapter();
  }
}
