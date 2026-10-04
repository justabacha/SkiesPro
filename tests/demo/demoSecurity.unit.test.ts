import { cacheClient } from '../../src/infrastructure/cache/index.js';
import { PriceFeedIngestionService } from '../../src/modules/pricing/services/PriceFeedIngestionService.js';
import { DemoPriceTickSubscriber } from '../../src/modules/pricing/websocket/demoPriceTickSubscriber.js';
import { ConnectionManager } from '../../src/modules/pricing/websocket/connectionManager.js';
import { TickRepository } from '../../src/modules/pricing/repositories/tickRepository.js';
import { ContractRepository } from '../../src/modules/trading/repositories/contractRepository.js';
import { TradingService } from '../../src/modules/trading/services/tradingService.js';
import { PricingService } from '../../src/modules/pricing/services/pricingService.js';
import { UserRepository } from '../../src/modules/auth/repositories/userRepository.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { SettlementWorker } from '../../src/modules/trading/workers/settlementWorker.js';

jest.mock('../../src/modules/trading/repositories/contractRepository.js');
jest.mock('../../src/modules/pricing/repositories/tickRepository.js');
jest.mock('../../src/modules/trading/repositories/assetConfigRepository.js');
jest.mock('../../src/modules/trading/repositories/assetRepository.js');
jest.mock('../../src/modules/auth/repositories/userRepository.js');
jest.mock('../../src/modules/wallet/services/walletService.js');
jest.mock('../../src/modules/pricing/services/pricingService.js');
jest.mock('../../src/shared/services/idempotencyService.js');
jest.mock('../../src/infrastructure/message-queue/MessageQueueClient.js');

describe('WP-21 demo security routing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('DEMO-SEC-003: never forwards demo ticks to live WebSocket channels', async () => {
    let receiveMessage: ((message: string) => void) | undefined;
    const subscribe = jest
      .spyOn(cacheClient, 'subscribe')
      .mockImplementation(async (_cluster, channel, callback) => {
        expect(channel).toBe('demo:ticks:all');
        receiveMessage = callback;
      });
    const unsubscribe = jest.spyOn(cacheClient, 'unsubscribe').mockResolvedValue();
    const connectionManager = {
      sendToChannel: jest.fn(),
    } as unknown as ConnectionManager;
    const subscriber = new DemoPriceTickSubscriber(connectionManager);

    await subscriber.start();
    receiveMessage?.(
      JSON.stringify({
        source: 'demo',
        symbol: 'EUR/USD',
        bid: '1.10000',
        ask: '1.10010',
        mid: '1.10005',
        time: new Date().toISOString(),
      })
    );

    expect(connectionManager.sendToChannel).toHaveBeenCalledTimes(1);
    expect(connectionManager.sendToChannel).toHaveBeenCalledWith(
      'demo.price.EUR/USD',
      expect.stringContaining('"source":"demo"')
    );
    expect(connectionManager.sendToChannel).not.toHaveBeenCalledWith(
      expect.stringMatching(/^price\./),
      expect.anything()
    );
    await subscriber.stop();
    subscribe.mockRestore();
    unsubscribe.mockRestore();
  });

  it('DEMO-SEC-004: live settlement requests only live ticks', async () => {
    const contract = {
      id: 'live-contract',
      userId: 'security-user',
      accountType: 'real' as const,
      assetSymbol: 'EUR/USD',
      expiryTime: new Date(),
      strikePrice: '1.10000',
      stake: '100',
      payoutRate: '0.60',
      potentialPayout: '160',
      contractType: 'higher' as const,
      status: 'active' as const,
      purchaseTime: new Date(),
    };
    (ContractRepository.prototype.findByIdForSettlement as jest.Mock).mockResolvedValue(contract);
    (ContractRepository.prototype.updateStatusCAS as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    (TickRepository.prototype.getPriceAt as jest.Mock).mockResolvedValue(null);

    const worker = new SettlementWorker();
    await expect(worker.settle(contract.id)).rejects.toThrow('Price tick not found');

    expect(TickRepository.prototype.getPriceAt).toHaveBeenCalledWith(
      contract.assetSymbol,
      contract.expiryTime,
      'live'
    );
  });

  it('DEMO-SEC-005: tier3_mock always blocks live trades before wallet access', async () => {
    const originalTier = PriceFeedIngestionService.currentTier;
    PriceFeedIngestionService.currentTier = 'tier3_mock';
    (UserRepository.prototype.findById as jest.Mock).mockResolvedValue({
      status: 'active',
      self_excluded_until: null,
    });
    const tradingService = new TradingService({} as PricingService);

    try {
      await expect(
        tradingService.placeTrade('security-user', {
          assetSymbol: 'EUR/USD',
          contractType: 'higher',
          stake: '100',
          expirySeconds: 60,
        })
      ).rejects.toThrow('Trading is temporarily suspended');
      expect(WalletService.prototype.getBalance).not.toHaveBeenCalled();
    } finally {
      PriceFeedIngestionService.currentTier = originalTier;
    }
  });
});
