import { ConnectionManager } from '../../src/modules/pricing/websocket/connectionManager.js';
import { DemoPriceTickSubscriber } from '../../src/modules/pricing/websocket/demoPriceTickSubscriber.js';
import { cacheClient } from '../../src/infrastructure/cache/index.js';

describe('DemoPriceTickSubscriber', () => {
  it('forwards validated demo ticks only to the isolated demo channel', async () => {
    let receiveMessage: ((message: string) => void) | undefined;
    const subscribe = jest
      .spyOn(cacheClient, 'subscribe')
      .mockImplementation(async (_cluster, _channel, callback) => {
        receiveMessage = callback;
      });
    const unsubscribe = jest.spyOn(cacheClient, 'unsubscribe').mockResolvedValue();
    const connectionManager = {
      sendToChannel: jest.fn(),
    } as unknown as ConnectionManager;
    const subscriber = new DemoPriceTickSubscriber(connectionManager);

    try {
      await subscriber.start();
      expect(subscribe).toHaveBeenCalledWith('pricing', 'demo:ticks:all', expect.any(Function));

      receiveMessage?.(
        JSON.stringify({
          source: 'demo',
          symbol: 'EUR/USD',
          bid: '1.10000',
          ask: '1.10010',
          mid: '1.10005',
          time: '2026-02-01T12:00:00.000Z',
        })
      );

      expect(connectionManager.sendToChannel).toHaveBeenCalledWith(
        'demo.price.EUR/USD',
        expect.stringContaining('"source":"demo"')
      );
      await subscriber.stop();
      expect(unsubscribe).toHaveBeenCalledWith('pricing', 'demo:ticks:all');
    } finally {
      subscribe.mockRestore();
      unsubscribe.mockRestore();
    }
  });

  it('drops ticks without demo provenance', async () => {
    let receiveMessage: ((message: string) => void) | undefined;
    const subscribe = jest
      .spyOn(cacheClient, 'subscribe')
      .mockImplementation(async (_cluster, _channel, callback) => {
        receiveMessage = callback;
      });
    const unsubscribe = jest.spyOn(cacheClient, 'unsubscribe').mockResolvedValue();
    const connectionManager = {
      sendToChannel: jest.fn(),
    } as unknown as ConnectionManager;
    const subscriber = new DemoPriceTickSubscriber(connectionManager);

    try {
      await subscriber.start();
      receiveMessage?.(
        JSON.stringify({
          source: 'live',
          symbol: 'EUR/USD',
          bid: '1.10000',
          ask: '1.10010',
          mid: '1.10005',
          time: '2026-02-01T12:00:00.000Z',
        })
      );
      expect(connectionManager.sendToChannel).not.toHaveBeenCalled();
      await subscriber.stop();
    } finally {
      subscribe.mockRestore();
      unsubscribe.mockRestore();
    }
  });
});
