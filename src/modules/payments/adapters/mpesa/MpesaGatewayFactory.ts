import { IPaymentGateway } from './IPaymentGateway';
import { MpesaMockAdapter } from './MpesaMockAdapter';
import { DarajaMpesaAdapter } from './DarajaMpesaAdapter';

export class MpesaGatewayFactory {
  static getGateway(): IPaymentGateway {
    const mode = process.env.PAYMENT_GATEWAY_MODE || 'MOCK';

    if (mode === 'DARAJA') {
      return new DarajaMpesaAdapter();
    }

    return new MpesaMockAdapter();
  }
}
