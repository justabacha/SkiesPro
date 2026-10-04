import { PoolClient } from 'pg';
import { TickRepository, TickRow } from '../../src/modules/pricing/repositories/tickRepository.js';

describe('Demo tick source isolation', () => {
  const tick: TickRow = {
    id: 'tick-1',
    symbol: 'EUR/USD',
    tick_time: new Date('2026-02-01T12:00:00.000Z'),
    bid_price: '1.10000',
    ask_price: '1.10010',
    mid_price: '1.10005',
    volume: '0',
    source: 'demo',
    created_at: new Date('2026-02-01T12:00:00.000Z'),
  };

  it.each([
    ['live', 'live'],
    ['demo', 'demo'],
  ] as const)('filters latest ticks by the explicit %s source', async (_label, source) => {
    const query = jest.fn().mockResolvedValue({ rows: [tick] });
    const repository = new TickRepository({ query } as unknown as PoolClient);

    await repository.getLatest('EUR/USD', source);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('source = $2'), ['EUR/USD', source]);
  });

  it.each([
    ['live', 'live'],
    ['demo', 'demo'],
  ] as const)('filters expiry ticks by the explicit %s source', async (_label, source) => {
    const expiry = new Date('2026-02-01T12:00:00.000Z');
    const query = jest.fn().mockResolvedValue({ rows: [tick] });
    const repository = new TickRepository({ query } as unknown as PoolClient);

    await repository.getPriceAt('EUR/USD', expiry, source);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('source = $2'), [
      'EUR/USD',
      source,
      expiry,
    ]);
  });
});
