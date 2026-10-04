import { PoolClient } from 'pg';
import { ContractRepository } from '../../../src/modules/trading/repositories/contractRepository.js';

describe('ContractRepository account scoping', () => {
  it('includes settling contracts in mode-filtered exposure totals', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ total_exposure: '100' }] });
    const repository = new ContractRepository({ query } as unknown as PoolClient);

    await repository.getActiveExposure('EUR/USD', 'real');
    await repository.getActiveExposure('EUR/USD', 'demo', 'user-123');

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("status IN ('active', 'settling')"),
      ['EUR/USD', 'real']
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("status IN ('active', 'settling')"),
      ['EUR/USD', 'demo', 'user-123']
    );
  });
});
