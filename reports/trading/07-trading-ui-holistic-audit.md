# READ-ONLY FORENSIC AUDIT — Full Trading UI/Backend Mapping & Diagnostics

**Scope:** Trading UI, chart and price-stream hooks/services, pricing WebSocket gateway, trading placement and settlement.  
**Finding standard:** Confirmed code behavior is distinguished from production-only possibilities that require live tick frames or logs to verify.

## Executive findings

1. **The displayed Pips are calculated in the frontend, not by the backend.** For BTC/USD, the precision helper selects a pip size of `$0.01`; the UI divides the raw price difference by that amount. A `$117.45` drop therefore displays `-11,745.0 Pips`; a `$100` drop would display `-10,000.0 Pips`. The stated `$100` and `-11,745` values do not correspond to the same price delta.
2. **The chart explicitly converts candle timestamps to Unix seconds.** Milliseconds are divided by 1,000, so a millisecond/seconds mismatch is not evident in this implementation. More credible chart issues are flat/synthetic OHLC bars, incomplete gap filling, timeframe-agnostic normalization, mixed real/demo candle sources, and live updates that skip intervening bars.
3. **Line/Candle switching is a visibility toggle, not series recreation or a data reset.** Both series are created once, hidden initially, and share the default right scale and the same price-format settings. No `autoscaleInfoProvider` is configured. The scale margins alone do not explain candles collapsing to vertical lines.
4. **The “Disconnected” badge is not a reliable per-symbol socket indicator.** It renders `latencyState`, while connection state is tracked separately. Real ticks do not directly synchronize those states; latency updates depend on tick timestamps, and application `pong` messages are swallowed by the shared WebSocket client. A connected socket can therefore deliver prices while the badge remains stale or disconnected.
5. **No EUR/USD-specific rejection, mapping, or rate limit was found.** A canonical `EUR/USD` symbol is preserved by backend normalization and should match the backend’s `price.EUR/USD` channel. The implementation does contain broader subscription lifecycle and state-reporting risks; production frames/logs are needed to identify why a particular EUR/USD session shows the symptom.

## 1. Trading domain map and data flow

`frontend\src\pages\trading\TradingPage.tsx:32-35, 108-110, 169-178, 231-234` wires the page to `usePriceStream`, `LatencyIndicator`, `TradingChart`, `OrderForm`, and `OpenPositions`. Asset selection calls `subscribeToSymbol` (`:55-64`). The current selected price is passed to the chart and order form; the positions view receives a one-symbol price map (`:80-84, 231-234`).

The live quote path is:

`PriceFeedIngestionService.handleTick` → price validation → `PriceDistributionService.distributeTick` → cache and Redis pub/sub → `PriceTickSubscriber` → subscribed WebSocket channel → `WebsocketService.handleMessage` → `usePriceStream.acceptTick` → chart and order UI.

Relevant backend references: `src\modules\pricing\services\PriceFeedIngestionService.ts:213-238`, `src\modules\pricing\services\priceDistributionService.ts:11-29`, `src\modules\pricing\websocket\priceTickSubscriber.ts:24-25, 100-125`. The initial HTTP quote comes from `usePriceStream.ts:97-148`; candle history comes from `TradingChart.tsx:436-451` through `frontend\src\modules\trading\services\tradingService.ts` and the pricing service.

Trade submission is a separate path. `useTrading.ts:436-463` captures the displayed current price as the client strike; `src\modules\trading\services\tradingService.ts:131-180` validates the server’s cached tick and stores an entry price from `ask` for higher contracts or `bid` for lower contracts. Settlement later reads persisted ticks and delegates binary outcome/payout to `PayoutService` (`src\modules\trading\workers\settlementWorker.ts:122-164`).

## 2. Charting engine and candle data

### Chart options and series

`frontend\src\modules\trading\components\TradingChart.tsx:242-282` creates one chart:

```ts
rightPriceScale: {
  borderColor: 'rgba(148, 163, 184, 0.2)',
  autoScale: true,
  mode: PriceScaleMode.Normal,
  alignLabels: true,
  borderVisible: false,
  scaleMargins: { top: 0.2, bottom: 0.2 },
},
timeScale: {
  borderColor: 'rgba(148, 163, 184, 0.2)',
  timeVisible: true,
  barSpacing: window.innerWidth < 640 ? 16 : 10,
  rightOffset: 2,
},
crosshair: { mode: 1 },
```

The right scale options, including the same 20% margins, are applied again at `:275-283`. No `autoscaleInfoProvider` is present. Both series are created once at `:302-318` with `visible: false`, `priceFormat: initialPriceFormat`, and no explicit alternate scale ID:

- Candles: green/red up/down colors; `borderVisible: false`; matching green/red wick colors.
- Area: green line and gradient fill; `lineWidth: 2`.
- Both receive the same initial price format and both receive the same updated format at `:358-373`.

Thus, **no conflicting `priceFormat` or explicit separate price scale is configured**. The series use the default price scale; the chart does not contain a scale provider that would independently force candle values into a line.

### Timestamp normalization and mode switching

`toUnixSeconds` at `TradingChart.tsx:51-67` accepts `Date`, number, or string. Values above `1_000_000_000_000` are treated as milliseconds and divided by 1,000; ISO strings are parsed as dates. `normalizeCandles` at `:70-119` uses that conversion for `open_time`, converts OHLC values to numbers, rejects some invalid bars, deduplicates by timestamp, and sorts ascending. **The observed normalization path returns integer Unix seconds**, as Lightweight Charts expects.

Line/Candle switching at `:353-355` only applies `visible` options to the two existing series. It does not recreate either series or clear their data. Price lines are recreated for the currently visible series at `:516` onward. This is not a data-reset implementation, although the two series intentionally have different update cadence: candle updates use a timeframe bucket, while area updates use the tick’s second (`:202-222`).

### Chart defects and likely causes

- **Vertical candle lines are consistent with flat/doji bars.** `OHLCService.processTick` initializes each candle with open/high/low/close all equal to the first tick (`src\modules\pricing\services\OHLCService.ts:21-50`). With sparse ticks or little price movement, open and close can remain equal. The chart also sets `borderVisible: false`; a zero-height body with a high/low range appears as a wick/vertical line. This is a plausible data-shape explanation, not proof about the production candle payload.
- **Gap filling is partial and uses the wrong interval for non-1-minute charts.** `normalizeCandles` defaults `granularitySeconds` to 60 (`TradingChart.tsx:70-74`), but the history loader calls `normalizeCandles(data)` without passing the selected granularity (`:436-441`). For 5m, 15m, hourly, or daily data, it can synthesize one-minute flat bars between actual timeframe bars. It caps fills at 100 missing bars per gap (`:102-116`), leaving larger gaps unfilled. No leading/trailing fill is added.
- **Live candle updates do not fill skipped intervals.** `applyTick` creates a candle at the next tick’s bucket (`:202-216`) rather than inserting intermediate candles. A long pause followed by a new tick can therefore leave a time gap even if history gaps were previously synthesized.
- **Same-second ticks are dropped.** The handler rejects timestamps less than or equal to either tracked latest time (`:179-183`); `latestAreaTimeRef` is set to the tick’s integer second (`:222`). Distinct ticks arriving in the same second cannot update either series.
- **Real and demo candle histories are not source-separated.** `PricingService.getCandles` selects a symbol and timeframe but no source (`src\modules\pricing\services\pricingService.ts:46-80`); `CandleRepository` returns both sources (`src\modules\pricing\repositories\candleRepository.ts:54-72`). Aggregation groups by source (`:76-116`), so the API can return two candles at the same timestamp. The frontend’s `Map` keys only by timestamp (`TradingChart.tsx:77-99`), making one source overwrite the other, with no deterministic source policy. Demo mode then multiplies all fetched candles by `0.999` (`:441-449`) while streaming demo ticks separately.
- **Live-follow behavior is not explicit after history load.** The visible range and `scrollToRealTime()` are set once after history resolves (`:470-474`); tick updates do not explicitly maintain the viewport. This is a candidate for perceived drift if the user has panned or the time scale has moved.
- **History failures can look like empty history rather than a reported failure.** `frontend\src\modules\trading\services\tradingService.ts` catches candle-fetch errors and returns `[]`; consequently, the chart’s history `.catch` handler (`TradingChart.tsx:478-490`) will not see those errors.

The history effect’s `isCurrent` guard prevents a completed stale request from applying after symbol/timeframe changes (`TradingChart.tsx:417-493`). That is a useful race guard. However, the source/timeframe and live-update issues above remain.

## 3. Pips display and backend calculation

### Frontend source and exact math

The chart’s active-contract Pips pill is rendered by `TradingChart.tsx:406-414, 620-626`; active-position rows calculate and render their own value in `OpenPositions.tsx:156-161, 229`.

`frontend\src\modules\trading\utils\pricePrecision.ts:1-20` assigns BTC and ETH two decimal places. For those symbols:

```ts
pipSize = 10 ** -2 = 0.01
pipDelta = (currentPrice - strikePrice) / pipSize
```

That is **price movement expressed in cents**, not an asset-independent Pips convention. For BTC/USD:

- `-$117.45 / $0.01 = -11,745.0 Pips`
- `-$100.00 / $0.01 = -10,000.0 Pips`

Therefore, the shown `-11,745.0` corresponds to a `-$117.45` spot-versus-strike difference under the current formula. If production telemetry confirms a `$100` difference, the observed display would require another input or code path; those two figures do not reconcile under this implementation.

A related display logic defect affects **lower** contracts: both components calculate `current - strike` without reversing the sign for a lower position (`TradingChart.tsx:413-414`; `OpenPositions.tsx:158-161`). The displayed sign can therefore indicate an unfavorable price direction as positive, even while the status says “WINNING.” The chart also compares current spot against the stored strike, while placement stores ask/bid rather than spot (`src\modules\trading\services\tradingService.ts:169`), so spread is included in the displayed difference.

### Backend role and separate settlement issue

No backend code generates the displayed Pips string or this UI delta. Backend placement uses Decimal arithmetic to validate client strike and choose the entry price (`src\modules\trading\services\tradingService.ts:156-180`); settlement calculates binary win/loss and payout (`src\modules\trading\services\payoutService.ts:17-60`).

Settlement does contain a separate asset-agnostic draw tolerance:

```ts
const diff = settlementPrice.minus(strikePrice).abs();
const DRAW_TOLERANCE = new Decimal('0.00001');
if (diff.lt(DRAW_TOLERANCE)) { ... }
```

(`src\modules\trading\services\payoutService.ts:22-26`). The tolerance is fixed in raw price units and is not tied to symbol precision or the frontend pip size. It does **not** explain the displayed `-11,745 Pips`, but it is a separate cross-asset settlement inconsistency to review.

## 4. WebSocket state, subscriptions, and EUR/USD symptom

### Connection and subscription flow

`usePriceStream.ts:150-163` initializes the singleton WebSocket service when authenticated. The subscription effect registers tick, latency, and connection callbacks, then subscribes to the current symbol (`:166-200`). On symbol changes, its cleanup unsubscribes the previous symbol and removes callbacks.

`WebsocketService.subscribeSymbol` stores one global `currentSymbol/currentMode`; when connected, it unsubscribes the previous channel and subscribes the new one (`frontend\src\modules\trading\services\websocketService.ts:66-82`). Channels are `price` or `demo.price` with the raw symbol (`:211-213`).

The backend subscription manager constructs an exact channel key from the trimmed symbol (`src\modules\pricing\websocket\subscriptionManager.ts:129-179`); `PriceTickSubscriber` normalizes the published symbol and sends to `price.<symbol>` (`src\modules\pricing\websocket\priceTickSubscriber.ts:100-125`). For canonical `EUR/USD`, backend `normalizeSymbol` preserves the slash, so the subscription and publication key match. **No EUR/USD-specific unsubscribe or gateway rejection is visible.** A noncanonical client symbol such as `EURUSD`, however, can be stored under `price.EURUSD` while the publisher emits canonical `price.EUR/USD`; this can break subscriptions for noncanonical symbol inputs.

### Confirmed badge-state desynchronization

`TradingPage.tsx:108-110` passes `latencyState` to `LatencyIndicator`, while `usePriceStream` separately tracks `isConnected`. `LatencyIndicator.tsx:9-14` determines “Disconnected” from `latencyState.isConnected` or `latencyState.status`, not the separate socket boolean.

On a socket connect, `WebsocketService` calls `notifyConnectionState(true)` but does not publish a new latency state (`websocketService.ts:36-43`). On a real tick, latency is updated only when `tick_time` parses and its computed delta is strictly greater than zero and below five seconds (`:172-181`). By contrast, the demo path sets both states directly in `usePriceStream.ts:91-92`. Thus, a real EUR/USD tick can update the price while the latency badge remains at a prior disconnected/connecting state—for example when reconnect has occurred but no tick qualifies for a latency update. The indicator’s latency is global, not symbol-specific, so “EUR/USD disconnected” is not a trustworthy per-symbol channel diagnosis.

The shared WebSocket client handles application `pong` messages without forwarding them to `WebsocketService.handleMessage` (`frontend\src\shared\ws\websocketClient.ts:138-167`, especially `:158`). The service’s ping RTT calculation is in `websocketService.ts:186-190`; it therefore does not receive those pongs through this client path. In practice, latency updates rely on eligible tick timestamps rather than the intended ping round-trip.

### Lifecycle and service risks

- `WebSocketClient.subscribe` appends to an array (`websocketClient.ts:83-89`); reconnect resends the array (`:127-135`). `WebsocketService.onConnected` also subscribes the current symbol (`websocketService.ts:36-43`). This can produce duplicate subscribe messages. The server stores channel keys in a `Set`, so duplicates are generally idempotent server-side, but the client retains redundant subscription entries until unsubscribe.
- `WebsocketService` owns one global symbol and mode. Multiple mounted consumers could replace one another’s active subscription (`websocketService.ts:66-82`); the current `TradingPage` has one `usePriceStream` consumer.
- Gateway mutation callbacks are per connection, while `PriceTickSubscriber.activeChannels` is a set without per-symbol reference counts (`src\modules\pricing\websocket\priceGateway.ts:32-41`; `priceTickSubscriber.ts:17-26, 40-57`). If multiple clients subscribe to one symbol, one client’s unsubscribe can remove the shared Redis subscription while another client still expects it.
- Subscribe/unsubscribe callbacks are launched with `void` (`priceGateway.ts:32-41`). If an unsubscribe arrives before an asynchronous subscribe finishes, the channel can remain subscribed after the client has moved on.
- `PriceGateway.rateLimitMap` is keyed by connection ID and has no visible removal on connection close (`priceGateway.ts:24, 188-205`), creating an unbounded per-connection map over gateway lifetime.
- The hook removes its registered callbacks and unsubscribes on effect cleanup (`usePriceStream.ts:174-200`), but an authenticated mount does not visibly disconnect the singleton on component unmount. If no broader application owner manages the singleton, the socket and ping interval can outlive the page.

The hook’s dependency arrays include symbol, account mode, generation, authentication, and user ID where relevant (`usePriceStream.ts:148, 200`); there is no clear missing symbol dependency that alone explains an ordinary re-render disconnect. Live production frames and gateway logs are still needed to determine whether a specific session encountered a rejected subscription or stale socket.

## 5. Additional data integrity and trading risks

- `WebsocketService.handleMessage` accepts `price` or `mid`, but does not derive a fallback from `bid` and `ask`; missing/malformed price becomes zero and is rejected later (`websocketService.ts:154-161`; `usePriceStream.ts:61-66`). Missing tick timestamps are replaced with the current time in the service (`:168`), which can make a timestamp-less tick appear fresh rather than report missing timing data.
- The initial REST quote also substitutes the current time when quote time is absent (`usePriceStream.ts:121-135`). `fetchLivePrice` runs on mount/symbol/context changes, not as a continuous quote poll (`:97-148`); ongoing price movement requires the stream.
- Live ticks are published and cached before the persistence batch is flushed (`PriceFeedIngestionService.ts:197-238`). `flushTicks` clears the in-memory buffer before writing and logs a failed `saveBatch` without restoring it (`:197-210`). Consequently, WebSocket/cache prices can be visible even when the corresponding tick rows are not persisted; settlement reads the database (`settlementWorker.ts:122-164`).
- Settlement first requests a tick at or before expiry, then falls back to the latest tick (`settlementWorker.ts:122-133`). The oracle-gap check rejects only when `oracleGapMs > MAX_ORACLE_GAP_MS` (`:146-157`); a fallback tick newer than expiry yields a negative gap and is not rejected by that condition. This warrants review against the intended settlement-price policy.
- `TradingChart.normalizeCandles` checks that high is not below low/open/close (`TradingChart.tsx:87-90`), but does not reject low above open or close. Invalid OHLC shapes can therefore pass part of its validation.
- The chart renders only the last matching contract for its pill (`TradingChart.tsx:410-415`), whereas `OpenPositions` renders every contract. If multiple active contracts exist for one symbol, the pill is not an aggregate position Pips total.

## Conclusion

The strongest confirmed explanations are: **BTC Pips are raw price movement divided by a one-cent unit; chart data can contain flat bars, unfilled or misaligned gaps, and mixed-source candles; and the latency badge can remain disconnected while the real-price stream is active because its state is updated separately from socket connectivity.** The current code does not establish an EUR/USD-only backend failure. Production WebSocket frames, subscription acknowledgements/errors, and the actual strike/current-price pair are needed to attribute that specific instance beyond the confirmed state-reporting defect.

HOLISTIC TRADING UI AUDIT COMPLETE — NO SOURCE CHANGES MADE
