import { MpesaGatewayFactory } from '../../src/modules/payments/adapters/mpesa/MpesaGatewayFactory';
import { MpesaMockAdapter } from '../../src/modules/payments/adapters/mpesa/MpesaMockAdapter';
import { DarajaMpesaAdapter } from '../../src/modules/payments/adapters/mpesa/DarajaMpesaAdapter';

describe('MpesaGatewayFactory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return MpesaMockAdapter when mode is MOCK', () => {
    process.env.PAYMENT_GATEWAY_MODE = 'MOCK';
    const gateway = MpesaGatewayFactory.getGateway();
    expect(gateway).toBeInstanceOf(MpesaMockAdapter);
  });

  it('should return DarajaMpesaAdapter when mode is DARAJA', () => {
    process.env.PAYMENT_GATEWAY_MODE = 'DARAJA';
    const gateway = MpesaGatewayFactory.getGateway();
    expect(gateway).toBeInstanceOf(DarajaMpesaAdapter);
  });

  it('should default to MpesaMockAdapter when mode is not set', () => {
    delete process.env.PAYMENT_GATEWAY_MODE;
    const gateway = MpesaGatewayFactory.getGateway();
    expect(gateway).toBeInstanceOf(MpesaMockAdapter);
  });
});
