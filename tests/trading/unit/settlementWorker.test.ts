import { SettlementWorker } from '../../../src/modules/trading/workers/settlementWorker.js';
import { ContractRepository } from '../../../src/modules/trading/repositories/contractRepository.js';
import { TickRepository } from '../../../src/modules/pricing/repositories/tickRepository.js';
import { pgPool } from '../../../src/config/database.js';

jest.mock('../../../src/modules/trading/repositories/contractRepository.js');
jest.mock('../../../src/modules/pricing/repositories/tickRepository.js');
jest.mock('../../../src/shared/services/idempotencyService.js');
jest.mock('../../../src/infrastructure/message-queue/MessageQueueClient.js');
jest.mock('../../../src/config/database.js', () => ({
  pgPool: {
    connect: jest.fn(),
  },
}));

describe('SettlementWorker (SET-UNIT-004 to 010)', () => {
  let worker: SettlementWorker;
  let contractRepo: jest.Mocked<ContractRepository>;
  let tickRepo: jest.Mocked<TickRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new SettlementWorker();
    contractRepo = (worker as any).contractRepo;
    tickRepo = (worker as any).tickRepo;
  });

  const testContractId = 'contract-123';
  const testContract = {
    id: testContractId,
    userId: 'user-123',
    accountType: 'real' as const,
    assetSymbol: 'EUR/USD',
    expiryTime: new Date(),
    strikePrice: '1.10000',
    stake: '1000',
    payoutRate: '0.60',
    potentialPayout: '1600',
    contractType: 'higher' as const,
    status: 'active' as const,
    purchaseTime: new Date(),
  };

  test('SET-UNIT-004: settle_duplicateJob_discarded - should not proceed if CAS fails', async () => {
    contractRepo.findByIdForSettlement.mockResolvedValue(testContract);
    contractRepo.updateStatusCAS.mockResolvedValue(false);

    await worker.settle(testContractId);

    expect(contractRepo.updateStatusCAS).toHaveBeenCalledWith(
      testContractId,
      'real',
      'active',
      'settling'
    );
    expect(tickRepo.getPriceAt).not.toHaveBeenCalled();
  });

  test('SET-UNIT-005: should fetch settlement price from repository (DB)', async () => {
    contractRepo.updateStatusCAS.mockResolvedValue(true);
    contractRepo.findByIdForSettlement.mockResolvedValue(testContract);
    tickRepo.getPriceAt.mockResolvedValue({
      mid_price: '1.09000',
      tick_time: testContract.expiryTime.toISOString(),
    } as any);

    // Connect mock
    const mockClient = {
      query: jest.fn().mockImplementation((queryText: string) => {
        if (queryText.includes('FROM wallet.wallets')) {
          return {
            rows: [
              {
                id: 'wallet-123',
                balance: '10000',
                locked_balance: '0',
                currency: 'KES',
                version: 1,
              },
            ],
          };
        }
        if (queryText.includes('INSERT INTO events.event_outbox')) {
          return { rows: [{ id: 'event-123' }] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    (pgPool.connect as jest.Mock).mockResolvedValue(mockClient);

    try {
      await worker.settle(testContractId);
    } catch {}

    expect(tickRepo.getPriceAt).toHaveBeenCalledWith('EUR/USD', testContract.expiryTime, 'live');
  });

  test('SET-UNIT-008: settle_contractAlreadySettled_ignored - handled by CAS in practice', async () => {
    contractRepo.findByIdForSettlement.mockResolvedValue(testContract);
    contractRepo.updateStatusCAS.mockResolvedValue(false);
    await worker.settle(testContractId);
    expect(tickRepo.getPriceAt).not.toHaveBeenCalled();
  });

  test('SET-UNIT-010: settle_outboxEventWritten - should use transactions and outbox', async () => {
    contractRepo.updateStatusCAS.mockResolvedValue(true);
    contractRepo.findByIdForSettlement.mockResolvedValue(testContract);

    tickRepo.getPriceAt.mockResolvedValue({
      mid_price: '1.09000',
      tick_time: testContract.expiryTime.toISOString(),
    } as any);

    const mockClient = {
      query: jest.fn().mockImplementation((queryText: string) => {
        if (queryText.includes('FROM wallet.wallets')) {
          return {
            rows: [
              {
                id: 'wallet-123',
                balance: '10000',
                locked_balance: '0',
                currency: 'KES',
                version: 1,
              },
            ],
          };
        }
        if (queryText.includes('INSERT INTO events.event_outbox')) {
          return { rows: [{ id: 'event-123' }] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };
    (pgPool.connect as jest.Mock).mockResolvedValue(mockClient);

    await worker.settle(testContractId);

    expect(mockClient.query).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL REPEATABLE READ');
    expect(tickRepo.getPriceAt).toHaveBeenCalledWith('EUR/USD', testContract.expiryTime, 'live');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO events.event_outbox'),
      expect.any(Array)
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });

  test('settle: should revert status to active if an error occurs during settlement', async () => {
    contractRepo.updateStatusCAS.mockResolvedValue(true);
    contractRepo.findByIdForSettlement.mockResolvedValue(testContract);
    tickRepo.getPriceAt.mockRejectedValue(new Error('DB Error'));

    await expect(worker.settle(testContractId)).rejects.toThrow('DB Error');
    expect(contractRepo.updateStatusCAS).toHaveBeenCalledWith(
      testContractId,
      'real',
      'settling',
      'active'
    );
  });

  test('settles demo contracts using only demo price ticks', async () => {
    const demoContract = { ...testContract, accountType: 'demo' as const };
    contractRepo.findByIdForSettlement.mockResolvedValue(demoContract);
    contractRepo.updateStatusCAS.mockResolvedValue(true);
    tickRepo.getPriceAt.mockResolvedValue({
      mid_price: '1.09000',
      tick_time: demoContract.expiryTime.toISOString(),
    } as any);
    (pgPool.connect as jest.Mock).mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    });

    await worker.settle(testContractId);

    expect(tickRepo.getPriceAt).toHaveBeenCalledWith('EUR/USD', demoContract.expiryTime, 'demo');
  });

  test('rejects a contract with an invalid persisted account type before settling', async () => {
    contractRepo.findByIdForSettlement.mockResolvedValue({
      ...testContract,
      accountType: 'unknown',
    } as any);

    await expect(worker.settle(testContractId)).rejects.toThrow('has an invalid account type');
    expect(contractRepo.updateStatusCAS).not.toHaveBeenCalled();
    expect(tickRepo.getPriceAt).not.toHaveBeenCalled();
  });
});
