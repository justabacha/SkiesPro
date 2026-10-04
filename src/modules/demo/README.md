# Demo trading module

Demo endpoints are mounted below `/api/v1/demo` and require an authenticated user,
`DEMO_ENABLED=true`, and a positive `DEMO_INITIAL_BALANCE_KES`. Demo wallet entries
use a separate wallet row and `demo_*` ledger references; the database trigger
rejects references that do not match the wallet's account type.

Demo trades share contract storage but are explicitly tagged `account_type='demo'`.
Their expiry settlement selects only `source='demo'` ticks and credits only the
demo wallet. Demo pricing uses the isolated mock adapter, Redis topic namespace,
and `demo.price.{symbol}` WebSocket channel. Live payment and upstream price-feed
services are not used by demo trade or wallet services.

Wallet resets are idempotent and serialized per user. A reset is rejected while
any demo contract is active or settling, and the durable reset-event table limits
successful resets to five per rolling hour. Demo ticks older than 90 days may be
pruned; ledger and audit rows are retained.

Keep the feature disabled until migration 033 has been applied and verified on a
disposable database. Never use demo endpoints to credit, withdraw, or transfer
real funds.
