import { IB2CPayoutGateway } from './IB2CPayoutGateway.js';
import { MpesaB2CMockAdapter } from './MpesaB2CMockAdapter.js';
import { DarajaB2CAdapter } from './DarajaB2CAdapter.js';

export class B2CGatewayFactory {
  static getB2CGateway(): IB2CPayoutGateway {
    const mode = process.env.PAYMENT_GATEWAY_MODE || 'MOCK';

    if (mode === 'DARAJA') {
      return new DarajaB2CAdapter();
    }

    return new MpesaB2CMockAdapter();
  }
}

export const getB2CGateway = (): IB2CPayoutGateway => B2CGatewayFactory.getB2CGateway();
