import { SettlementRecoveryJob } from '../../../src/modules/trading/workers/settlementRecovery.job.js';
import { pgPool } from '../../../src/config/database.js';

jest.mock('../../../src/config/database.js', () => ({
  pgPool: {
    query: jest.fn(),
  },
}));

describe('SettlementRecoveryJob', () => {
  let job: SettlementRecoveryJob;

  beforeEach(() => {
    jest.clearAllMocks();
    job = new SettlementRecoveryJob(1000);
  });

  afterEach(async () => {
    await job.stop();
  });

  test('recovers orphaned settling contracts by resetting status to active', async () => {
    const mockRows = [
      { id: 'contract-1', account_type: 'real' },
      { id: 'contract-2', account_type: 'demo' },
    ];
    (pgPool.query as jest.Mock).mockResolvedValue({ rows: mockRows });

    const recoveredCount = await job.recoverOrphanedSettlingContracts();

    expect(recoveredCount).toBe(2);
    expect(pgPool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE trading.binary_contracts")
    );
    expect(pgPool.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'active'")
    );
    expect(pgPool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE status = 'settling'")
    );
  });
});
