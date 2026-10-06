import { WalletRepository } from '../../src/modules/wallet/repositories/walletRepository.js';
import { WalletController } from '../../src/modules/wallet/controllers/walletController.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';

jest.mock('../../src/modules/wallet/repositories/walletRepository');

describe('WalletService.getWalletBalance', () => {
  const findByUserId = WalletRepository.prototype.findByUserId as jest.Mock;
  let service: WalletService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WalletService();
  });

  it('returns a zero balance for an account without a real wallet', async () => {
    findByUserId.mockResolvedValue(null);

    await expect(service.getWalletBalance('staff-id')).resolves.toEqual({
      available_balance: '0.00',
      pending_balance: '0.00',
      currency: 'KES',
      exists: false,
    });
  });

  it('returns the actual balance and wallet existence when present', async () => {
    findByUserId.mockResolvedValue({
      balance: '25.00',
      locked_balance: '5.00',
      available_balance: '20.00',
      currency: 'KES',
    });

    await expect(service.getWalletBalance('trader-id')).resolves.toEqual({
      balance: '25.00',
      locked_balance: '5.00',
      available_balance: '20.00',
      pending_balance: '0.00',
      currency: 'KES',
      exists: true,
    });
  });

  it('returns HTTP 200 and the empty-wallet shape from the balance endpoint', async () => {
    const controller = new WalletController();
    const getWalletBalance = jest.fn().mockResolvedValue({
      available_balance: '0.00',
      pending_balance: '0.00',
      currency: 'KES',
      exists: false,
    });
    (controller as unknown as { walletService: { getWalletBalance: jest.Mock } }).walletService = {
      getWalletBalance,
    };
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.getBalance(
      { user: { sub: 'staff-id' }, correlationId: 'request-id' } as never,
      response as never
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          available_balance: '0.00',
          pending_balance: '0.00',
          currency: 'KES',
          exists: false,
        },
      })
    );
  });
});
