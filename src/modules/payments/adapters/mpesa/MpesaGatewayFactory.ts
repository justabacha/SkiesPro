import { IPaymentGateway } from './IPaymentGateway.js';
import { MpesaMockAdapter } from './MpesaMockAdapter.js';
import { DarajaMpesaAdapter } from './DarajaMpesaAdapter.js';
import { IntaSendCollectionAdapter } from '../intasend/IntaSendCollectionAdapter.js';

export class MpesaGatewayFactory {
  static getGateway(): IPaymentGateway {
    const mode = (process.env.PAYMENT_GATEWAY_MODE || 'MOCK').toUpperCase();

    if (mode === 'INTASEND') {
      return new IntaSendCollectionAdapter();
    }

    if (mode === 'DARAJA') {
      return new DarajaMpesaAdapter();
    }

    if (mode === 'MOCK') {
      return new MpesaMockAdapter();
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Unknown PAYMENT_GATEWAY_MODE "${process.env.PAYMENT_GATEWAY_MODE || 'MOCK'}". Valid: MOCK, DARAJA, INTASEND.`
      );
    }

    return new MpesaMockAdapter();
  }
}
