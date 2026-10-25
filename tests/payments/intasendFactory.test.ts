import { B2CGatewayFactory } from '../../src/modules/payments/adapters/mpesa/B2CGatewayFactory.js';
import { MpesaGatewayFactory } from '../../src/modules/payments/adapters/mpesa/MpesaGatewayFactory.js';
import { MpesaMockAdapter } from '../../src/modules/payments/adapters/mpesa/MpesaMockAdapter.js';
import { MpesaB2CMockAdapter } from '../../src/modules/payments/adapters/mpesa/MpesaB2CMockAdapter.js';
import { DarajaMpesaAdapter } from '../../src/modules/payments/adapters/mpesa/DarajaMpesaAdapter.js';
import { DarajaB2CAdapter } from '../../src/modules/payments/adapters/mpesa/DarajaB2CAdapter.js';
import { IntaSendCollectionAdapter } from '../../src/modules/payments/adapters/intasend/IntaSendCollectionAdapter.js';
import { IntaSendB2CAdapter } from '../../src/modules/payments/adapters/intasend/IntaSendB2CAdapter.js';

describe('IntaSend gateway factory wiring', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns the IntaSend collection adapter in INTASEND mode', () => {
    process.env.PAYMENT_GATEWAY_MODE = 'INTASEND';
    expect(MpesaGatewayFactory.getGateway()).toBeInstanceOf(IntaSendCollectionAdapter);
  });

  it('returns the IntaSend B2C adapter in INTASEND mode', () => {
    process.env.PAYMENT_GATEWAY_MODE = 'INTASEND';
    expect(B2CGatewayFactory.getB2CGateway()).toBeInstanceOf(IntaSendB2CAdapter);
  });

  it('preserves MOCK and DARAJA behavior', () => {
    process.env.PAYMENT_GATEWAY_MODE = 'MOCK';
    expect(MpesaGatewayFactory.getGateway()).toBeInstanceOf(MpesaMockAdapter);
    expect(B2CGatewayFactory.getB2CGateway()).toBeInstanceOf(MpesaB2CMockAdapter);

    process.env.PAYMENT_GATEWAY_MODE = 'DARAJA';
    expect(MpesaGatewayFactory.getGateway()).toBeInstanceOf(DarajaMpesaAdapter);
    expect(B2CGatewayFactory.getB2CGateway()).toBeInstanceOf(DarajaB2CAdapter);
  });

  it('throws in production for unknown gateway mode values', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_GATEWAY_MODE = 'UNKNOWN';

    expect(() => MpesaGatewayFactory.getGateway()).toThrow(
      'Unknown PAYMENT_GATEWAY_MODE "UNKNOWN". Valid: MOCK, DARAJA, INTASEND.'
    );
    expect(() => B2CGatewayFactory.getB2CGateway()).toThrow(
      'Unknown PAYMENT_GATEWAY_MODE "UNKNOWN". Valid: MOCK, DARAJA, INTASEND.'
    );
  });

  it('defaults to MOCK in non-production when mode is unknown', () => {
    process.env.NODE_ENV = 'development';
    process.env.PAYMENT_GATEWAY_MODE = 'UNKNOWN';

    expect(MpesaGatewayFactory.getGateway()).toBeInstanceOf(MpesaMockAdapter);
    expect(B2CGatewayFactory.getB2CGateway()).toBeInstanceOf(MpesaB2CMockAdapter);
  });
});
