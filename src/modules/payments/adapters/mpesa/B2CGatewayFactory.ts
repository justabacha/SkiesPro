import { IB2CPayoutGateway } from './IB2CPayoutGateway.js';
import { MpesaB2CMockAdapter } from './MpesaB2CMockAdapter.js';
import { DarajaB2CAdapter } from './DarajaB2CAdapter.js';
import { IntaSendB2CAdapter } from '../intasend/IntaSendB2CAdapter.js';

export class B2CGatewayFactory {
  static getB2CGateway(): IB2CPayoutGateway {
    const mode = (process.env.PAYMENT_GATEWAY_MODE || 'MOCK').toUpperCase();

    if (mode === 'INTASEND') {
      return new IntaSendB2CAdapter();
    }

    if (mode === 'DARAJA') {
      return new DarajaB2CAdapter();
    }

    if (mode === 'MOCK') {
      return new MpesaB2CMockAdapter();
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Unknown PAYMENT_GATEWAY_MODE "${process.env.PAYMENT_GATEWAY_MODE || 'MOCK'}". Valid: MOCK, DARAJA, INTASEND.`
      );
    }

    return new MpesaB2CMockAdapter();
  }
}

export const getB2CGateway = (): IB2CPayoutGateway => B2CGatewayFactory.getB2CGateway();
