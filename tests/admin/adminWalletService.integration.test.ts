import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../src/config/database.js';
import { AdminWalletService } from '../../src/modules/admin/services/AdminWalletService.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

describe('AdminWalletService balance mutations', () => {
  let actorId: string;
  let userId: string;
  let walletId: string;
  let userWithoutWalletId: string;
  let createdActionIds: string[] = [];

  beforeAll(async () => {
    if (skipDatabaseTests) return;
    const actors = await pgPool.query<{ id: string }>(
      'SELECT id FROM app_auth.users ORDER BY created_at ASC LIMIT 1'
    );
    if (!actors.rows[0]) throw new Error('A test database actor is required');
    actorId = actors.rows[0].id;

    const email = `admin-wallet-${uuidv4()}@example.com`;
    const phone = `07${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
    const user = await pgPool.query<{ id: string }>(
      `INSERT INTO app_auth.users
         (email, password_hash, display_name, status, kyc_status, phone)
       VALUES ($1, 'test-hash', 'Admin Wallet Integration', 'active', 'verified', $2)
       RETURNING id`,
      [email, phone]
    );
    userId = user.rows[0].id;
    const wallet = await new WalletService().createWallet(userId, 'real', 'KES');
    walletId = wallet.id;

    const userWithoutWallet = await pgPool.query<{ id: string }>(
      `INSERT INTO app_auth.users
         (email, password_hash, display_name, status, kyc_status, phone)
       VALUES ($1, 'test-hash', 'Admin Wallet No Wallet Integration', 'active', 'verified', $2)
       RETURNING id`,
      [
        `admin-wallet-no-wallet-${uuidv4()}@example.com`,
        `08${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      ]
    );
    userWithoutWalletId = userWithoutWallet.rows[0].id;
  });

  afterAll(async () => {
    if (skipDatabaseTests || !userId) return;
    if (createdActionIds.length > 0) {
      await pgPool.query('DELETE FROM admin.admin_actions WHERE id = ANY($1::uuid[])', [createdActionIds]);
    }
    const testUserIds = [userId, userWithoutWalletId].filter(Boolean);
    if (testUserIds.length > 0) {
      await pgPool.query(
        `DELETE FROM wallet.ledger_entries
         WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = ANY($1::uuid[]))`,
        [testUserIds]
      );
      await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = ANY($1::uuid[])', [testUserIds]);
    }
    await pgPool.query('DELETE FROM app_auth.users WHERE id = ANY($1::uuid[])', [
      testUserIds,
    ]);
  });

  it('applies immediate adjustments and applies pending adjustments only when approved', async () => {
    if (skipDatabaseTests) return;
    const service = new AdminWalletService();

    const failedKey = `insufficient-${uuidv4()}`;
    await expect(service.adjustWallet({
      actorId,
      userId,
      amount: 100,
      type: 'debit',
      reason: 'Insufficient funds rollback test',
      idempotencyKey: failedKey,
    })).rejects.toThrow('Insufficient funds');
    const rolledBackAction = await pgPool.query(
      `SELECT id FROM admin.admin_actions WHERE details->>'idempotency_key' = $1`,
      [failedKey]
    );
    expect(rolledBackAction.rows).toHaveLength(0);

    const immediateKey = `small-${uuidv4()}`;
    const immediateInput = {
      actorId,
      userId,
      amount: 100,
      type: 'credit',
      reason: 'Small test adjustment',
      idempotencyKey: immediateKey,
    } as const;
    const immediate = await service.adjustWallet(immediateInput);
    createdActionIds.push(immediate.actionId!);
    expect(immediate.status).toBe('applied');
    const retriedImmediate = await service.adjustWallet(immediateInput);
    expect(retriedImmediate.actionId).toBe(immediate.actionId);

    let balance = await pgPool.query<{ balance: string }>(
      'SELECT balance FROM wallet.wallets WHERE id = $1',
      [walletId]
    );
    expect(Number(balance.rows[0].balance)).toBe(100);

    const pending = await service.adjustWallet({
      actorId,
      userId,
      amount: 600,
      type: 'credit',
      reason: 'Large test adjustment',
      idempotencyKey: `large-${uuidv4()}`,
    });
    createdActionIds.push(pending.actionId!);
    expect(pending.status).toBe('pending_second_approval');

    balance = await pgPool.query<{ balance: string }>(
      'SELECT balance FROM wallet.wallets WHERE id = $1',
      [walletId]
    );
    expect(Number(balance.rows[0].balance)).toBe(100);

    await service.approveAction(pending.actionId!, actorId);
    balance = await pgPool.query<{ balance: string }>(
      'SELECT balance FROM wallet.wallets WHERE id = $1',
      [walletId]
    );
    expect(Number(balance.rows[0].balance)).toBe(700);
  });

  it('creates a missing wallet and credits it during a wallet adjustment', async () => {
    if (skipDatabaseTests) return;
    const result = await new AdminWalletService().adjustWallet({
      actorId,
      userId: userWithoutWalletId,
      amount: 250,
      type: 'credit',
      reason: 'Create wallet during admin adjustment test',
      idempotencyKey: `missing-wallet-${uuidv4()}`,
    });
    createdActionIds.push(result.actionId!);
    expect(result.status).toBe('applied');

    const wallet = await pgPool.query<{ id: string; balance: string }>(
      `SELECT id, balance
       FROM wallet.wallets
       WHERE user_id = $1 AND account_type = 'real'`,
      [userWithoutWalletId]
    );
    expect(wallet.rows).toHaveLength(1);
    expect(Number(wallet.rows[0].balance)).toBe(250);
  });
});
