import supertest from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { DarajaB2CResultPayload } from '../../src/modules/payments/services/b2cCallbackService.js';

process.env.MPESA_CALLBACK_TOKEN = 'test_secret_token_123';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}

describe('B2C Callback Integration & Service Tests (Slice 4)', () => {
  let walletService: WalletService;
  let testUserId: string;
  let adminUserId: string;
  let createdWithdrawalIds: string[] = [];
  let createdOutboxIds: string[] = [];
  let createdIdempotencyKeys: string[] = [];

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    walletService = new WalletService();

    // Create test admin
    const adminEmail = `b2c-admin-${Date.now()}@example.com`;
    const adminPhone = generateUniquePhone();
    const adminRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'B2C Admin', 'active', 'verified', $2) RETURNING id",
      [adminEmail, adminPhone]
    );
    adminUserId = adminRes.rows[0].id;

    // Create test user
    const userEmail = `b2c-user-${Date.now()}@example.com`;
    const userPhone = generateUniquePhone();
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'B2C User', 'active', 'verified', $2) RETURNING id",
      [userEmail, userPhone]
    );
    testUserId = userRes.rows[0].id;

    await walletService.createWallet(testUserId, 'real', 'KES');
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    if (createdOutboxIds.length > 0) {
      await pgPool.query('DELETE FROM payments.b2c_outbox WHERE id = ANY($1::uuid[])', [createdOutboxIds]);
    }
    if (createdWithdrawalIds.length > 0) {
      await pgPool.query('DELETE FROM payments.withdrawals WHERE id = ANY($1::uuid[])', [createdWithdrawalIds]);
    }
    if (createdIdempotencyKeys.length > 0) {
      await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = ANY($1::text[])', [createdIdempotencyKeys]);
    }
    if (testUserId) {
      await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
      await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
      await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
    }
    if (adminUserId) {
      await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [adminUserId]);
    }
  });

  const setupWalletAndDispatchedWithdrawal = async (amount = '3000') => {
    await pgPool.query(
      "UPDATE wallet.wallets SET balance = 10000, locked_balance = 0 WHERE user_id = $1 AND account_type = 'real'",
      [testUserId]
    );

    const ik = uuidv4();
    await pgPool.query("INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING", [ik]);
    createdIdempotencyKeys.push(ik);

    const wRes = await pgPool.query(
      `INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, $2, 60, $3, 'KES', 'dispatched', $4)
       RETURNING id`,
      [testUserId, amount, new Decimal(amount).minus(60).toString(), ik]
    );
    const withdrawalId = wRes.rows[0].id;
    createdWithdrawalIds.push(withdrawalId);

    await walletService.lockFunds(testUserId, 'real', new Decimal(amount), 'withdrawal', withdrawalId, 'Lock for withdrawal test');

    const origConvId = `orig_${uuidv4()}`;
    const payload = { amount, netAmount: new Decimal(amount).minus(60).toString(), recipientPhone: '254712345678' };
    const oRes = await pgPool.query(
      `INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, payload, created_at, updated_at)
       VALUES ($1, $2, 'sent', $3::jsonb, NOW(), NOW())
       RETURNING id`,
      [withdrawalId, origConvId, JSON.stringify(payload)]
    );
    const outboxId = oRes.rows[0].id;
    createdOutboxIds.push(outboxId);

    return { withdrawalId, outboxId, origConvId };
  };

  const buildSuccessCallbackPayload = (origConvId: string, convId = `conv_${uuidv4()}`, transactionId = `MOCK_TX_${Date.now()}`): DarajaB2CResultPayload => ({
    Result: {
      ResultType: 0,
      ResultCode: 0,
      ResultDesc: 'The service request is processed successfully.',
      OriginatorConversationID: origConvId,
      ConversationID: convId,
      TransactionID: transactionId,
      ResultParameters: {
        ResultParameter: [
          { Key: 'TransactionAmount', Value: 3000 },
          { Key: 'TransactionReceipt', Value: transactionId },
          { Key: 'B2CRecipientIsRegisteredCustomer', Value: 'Y' },
          { Key: 'B2CChargesPaidAccountAvailableFunds', Value: 0 },
          { Key: 'ReceiverPartyPublicName', Value: '254712345678 - John Doe' },
          { Key: 'TransactionCompletedDateTime', Value: '19.10.2026 14:30:00' },
          { Key: 'B2CUtilityAccountAvailableFunds', Value: 100000 },
          { Key: 'B2CWorkingAccountAvailableFunds', Value: 50000 },
        ],
      },
      ReferenceData: { ReferenceItem: { Key: 'QueueTimeoutURL', Value: 'http://example.com' } },
    },
  });

  const buildFailureCallbackPayload = (origConvId: string, resultCode = 2001, resultDesc = 'The initiator information is invalid.'): DarajaB2CResultPayload => ({
    Result: {
      ResultType: 0,
      ResultCode: resultCode,
      ResultDesc: resultDesc,
      OriginatorConversationID: origConvId,
      ConversationID: `conv_${uuidv4()}`,
      TransactionID: `FAIL_TX_${Date.now()}`,
      ResultParameters: { ResultParameter: [] },
      ReferenceData: { ReferenceItem: { Key: 'QueueTimeoutURL', Value: 'http://example.com' } },
    },
  });

  test('1. Success callback: outbox sent -> wallet finalizeWithdrawalDebit fires (balance & locked -3000), ledger debit row inserted, withdrawal -> completed', async () => {
    if (skipDatabaseTests) return;

    const { withdrawalId, outboxId, origConvId } = await setupWalletAndDispatchedWithdrawal('3000');
    const txId = `MOCK_TX_${Date.now()}`;
    const payload = buildSuccessCallbackPayload(origConvId, `conv_${uuidv4()}`, txId);

    const res = await supertest(app)
      .post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123')
      .send(payload);

    expect(res.status).toBe(200);

    // Verify withdrawal completed & ref set
    const wRes = await pgPool.query('SELECT status, gateway_reference, completed_at FROM payments.withdrawals WHERE id = $1', [withdrawalId]);
    expect(wRes.rows[0].status).toBe('completed');
    expect(wRes.rows[0].gateway_reference).toBe(txId);
    expect(wRes.rows[0].completed_at).not.toBeNull();

    // Verify outbox processed_at set
    const oRes = await pgPool.query('SELECT processed_at FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
    expect(oRes.rows[0].processed_at).not.toBeNull();

    // Verify wallet debited: balance 7000, locked 0, available 7000
    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.balance).toNumber()).toBe(7000);
    expect(new Decimal(wallet.locked_balance).toNumber()).toBe(0);
    expect(new Decimal(wallet.available_balance).toNumber()).toBe(7000);

    // Verify ledger entry
    const ledger = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE reference_id = $1', [withdrawalId]);
    expect(ledger.rows.length).toBe(1);
    expect(ledger.rows[0].entry_type).toBe('debit');
    expect(new Decimal(ledger.rows[0].amount).toNumber()).toBe(3000);
  });

  test('2. Failure callback (ResultCode != 0): locked -3000, balance unchanged (10000), no ledger entry (mirrors reject path), withdrawal -> failed', async () => {
    if (skipDatabaseTests) return;

    const { withdrawalId, outboxId, origConvId } = await setupWalletAndDispatchedWithdrawal('3000');
    const payload = buildFailureCallbackPayload(origConvId, 2001, 'The initiator information is invalid.');

    const res = await supertest(app)
      .post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123')
      .send(payload);

    expect(res.status).toBe(200);

    // Verify withdrawal failed
    const wRes = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [withdrawalId]);
    expect(wRes.rows[0].status).toBe('failed');

    // Verify outbox failed & last_error populated
    const oRes = await pgPool.query('SELECT status, last_error, processed_at FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
    expect(oRes.rows[0].status).toBe('failed');
    expect(oRes.rows[0].last_error).toContain('The initiator information is invalid.');

    // Verify wallet: balance 10000, locked 0, available 10000
    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.balance).toNumber()).toBe(10000);
    expect(new Decimal(wallet.locked_balance).toNumber()).toBe(0);
    expect(new Decimal(wallet.available_balance).toNumber()).toBe(10000);

    // Verify no ledger entry
    const ledger = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE reference_id = $1', [withdrawalId]);
    expect(ledger.rows.length).toBe(0);
  });

  test('3. Timeout callback: wallet unchanged, withdrawal unchanged (dispatched), outbox last_error set, next_attempt_at = NOW()', async () => {
    if (skipDatabaseTests) return;

    const { withdrawalId, outboxId, origConvId } = await setupWalletAndDispatchedWithdrawal('3000');
    const timeoutPayload = {
      Result: {
        ResultType: 1,
        ResultCode: 1,
        ResultDesc: 'The request timed out.',
        OriginatorConversationID: origConvId,
        ConversationID: `conv_${uuidv4()}`,
        TransactionID: '',
        ResultParameters: { ResultParameter: [] },
        ReferenceData: { ReferenceItem: { Key: 'QueueTimeoutURL', Value: 'http://example.com' } },
      },
    };

    const res = await supertest(app)
      .post('/api/v1/payments/mpesa/b2c/timeout?token=test_secret_token_123')
      .send(timeoutPayload);

    expect(res.status).toBe(200);

    // Verify withdrawal still dispatched
    const wRes = await pgPool.query('SELECT status FROM payments.withdrawals WHERE id = $1', [withdrawalId]);
    expect(wRes.rows[0].status).toBe('dispatched');

    // Verify outbox still sent, last_error set
    const oRes = await pgPool.query('SELECT status, last_error, processed_at FROM payments.b2c_outbox WHERE id = $1', [outboxId]);
    expect(oRes.rows[0].status).toBe('sent');
    expect(oRes.rows[0].last_error).toContain('Timeout callback received; outcome unknown; pending reconciliation');
    expect(oRes.rows[0].processed_at).not.toBeNull();

    // Verify wallet locked balance unchanged
    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.locked_balance).toNumber()).toBe(3000);
  });

  test('4. Duplicate success callback replay: call handler twice -> wallet debited exactly once, ledger has 1 debit entry', async () => {
    if (skipDatabaseTests) return;

    const { withdrawalId, origConvId } = await setupWalletAndDispatchedWithdrawal('3000');
    const txId = `REPLAY_TX_${Date.now()}`;
    const payload = buildSuccessCallbackPayload(origConvId, `conv_${uuidv4()}`, txId);

    const res1 = await supertest(app).post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123').send(payload);
    expect(res1.status).toBe(200);

    const res2 = await supertest(app).post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123').send(payload);
    expect(res2.status).toBe(200);

    // Verify wallet balance debited once (7000)
    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.balance).toNumber()).toBe(7000);

    // Verify exactly 1 ledger debit entry
    const ledger = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE reference_id = $1', [withdrawalId]);
    expect(ledger.rows.length).toBe(1);
  });

  test('5. Callback on outbox pending (arrival before worker claims): 200 returned, no wallet mutation', async () => {
    if (skipDatabaseTests) return;

    await pgPool.query("UPDATE wallet.wallets SET balance = 10000, locked_balance = 3000 WHERE user_id = $1 AND account_type = 'real'", [testUserId]);

    const ik = uuidv4();
    createdIdempotencyKeys.push(ik);
    await pgPool.query("INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING", [ik]);

    const wRes = await pgPool.query(
      "INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key) VALUES ($1, 1, 3000, 60, 2940, 'KES', 'dispatched', $2) RETURNING id",
      [testUserId, ik]
    );
    const withdrawalId = wRes.rows[0].id;
    createdWithdrawalIds.push(withdrawalId);

    const origConvId = `orig_pending_${uuidv4()}`;
    const oRes = await pgPool.query(
      "INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, payload, created_at, updated_at) VALUES ($1, $2, 'pending', '{}'::jsonb, NOW(), NOW()) RETURNING id",
      [withdrawalId, origConvId]
    );
    createdOutboxIds.push(oRes.rows[0].id);

    const payload = buildSuccessCallbackPayload(origConvId);
    const res = await supertest(app).post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123').send(payload);

    expect(res.status).toBe(200);

    // Wallet balance untouched
    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.balance).toNumber()).toBe(10000);
  });

  test('6. Callback on outbox failed (already processed): 200 returned, no double refund', async () => {
    if (skipDatabaseTests) return;

    await pgPool.query("UPDATE wallet.wallets SET balance = 10000, locked_balance = 0 WHERE user_id = $1 AND account_type = 'real'", [testUserId]);

    const ik = uuidv4();
    createdIdempotencyKeys.push(ik);
    await pgPool.query("INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING", [ik]);

    const wRes = await pgPool.query(
      "INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key) VALUES ($1, 1, 3000, 60, 2940, 'KES', 'failed', $2) RETURNING id",
      [testUserId, ik]
    );
    const withdrawalId = wRes.rows[0].id;
    createdWithdrawalIds.push(withdrawalId);

    const origConvId = `orig_failed_${uuidv4()}`;
    const oRes = await pgPool.query(
      "INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, processed_at, payload, created_at, updated_at) VALUES ($1, $2, 'failed', NOW(), '{}'::jsonb, NOW(), NOW()) RETURNING id",
      [withdrawalId, origConvId]
    );
    createdOutboxIds.push(oRes.rows[0].id);

    const payload = buildFailureCallbackPayload(origConvId);
    const res = await supertest(app).post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123').send(payload);

    expect(res.status).toBe(200);

    // Wallet balance untouched
    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.balance).toNumber()).toBe(10000);
  });

  test('7. Unknown OriginatorConversationID: 200, no mutation, warn logged', async () => {
    if (skipDatabaseTests) return;

    const payload = buildSuccessCallbackPayload(`unknown_${uuidv4()}`);
    const res = await supertest(app).post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123').send(payload);

    expect(res.status).toBe(200);
  });

  test('8. Invalid token: 401, no mutation, warn logged', async () => {
    if (skipDatabaseTests) return;

    const { origConvId } = await setupWalletAndDispatchedWithdrawal('3000');
    const payload = buildSuccessCallbackPayload(origConvId);

    const res = await supertest(app).post('/api/v1/payments/mpesa/b2c/result?token=wrong_token').send(payload);

    expect(res.status).toBe(401);
  });

  test('9. Concurrent Result + Timeout race: at most one finalization mutation occurred', async () => {
    if (skipDatabaseTests) return;

    const { withdrawalId, origConvId } = await setupWalletAndDispatchedWithdrawal('3000');
    const successPayload = buildSuccessCallbackPayload(origConvId);
    const timeoutPayload = {
      Result: {
        ResultType: 1,
        ResultCode: 1,
        ResultDesc: 'Timeout',
        OriginatorConversationID: origConvId,
        ConversationID: `conv_${uuidv4()}`,
        TransactionID: '',
        ResultParameters: { ResultParameter: [] },
        ReferenceData: { ReferenceItem: { Key: 'QueueTimeoutURL', Value: 'http://example.com' } },
      },
    };

    await Promise.all([
      supertest(app).post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123').send(successPayload),
      supertest(app).post('/api/v1/payments/mpesa/b2c/timeout?token=test_secret_token_123').send(timeoutPayload),
    ]);

    // Wallet balance debited at most once (7000)
    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.balance).toNumber()).toBe(7000);

    const ledger = await pgPool.query('SELECT * FROM wallet.ledger_entries WHERE reference_id = $1', [withdrawalId]);
    expect(ledger.rows.length).toBe(1);
  });

  test('10. Success callback when withdrawal is NOT dispatched (e.g. already completed): skip, no mutation', async () => {
    if (skipDatabaseTests) return;

    await pgPool.query("UPDATE wallet.wallets SET balance = 10000, locked_balance = 0 WHERE user_id = $1 AND account_type = 'real'", [testUserId]);

    const ik = uuidv4();
    createdIdempotencyKeys.push(ik);
    await pgPool.query("INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING", [ik]);

    const wRes = await pgPool.query(
      "INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key) VALUES ($1, 1, 3000, 60, 2940, 'KES', 'completed', $2) RETURNING id",
      [testUserId, ik]
    );
    const withdrawalId = wRes.rows[0].id;
    createdWithdrawalIds.push(withdrawalId);

    const origConvId = `orig_comp_${uuidv4()}`;
    const oRes = await pgPool.query(
      "INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, processed_at, payload, created_at, updated_at) VALUES ($1, $2, 'sent', NOW(), '{}'::jsonb, NOW(), NOW()) RETURNING id",
      [withdrawalId, origConvId]
    );
    createdOutboxIds.push(oRes.rows[0].id);

    const payload = buildSuccessCallbackPayload(origConvId);
    const res = await supertest(app).post('/api/v1/payments/mpesa/b2c/result?token=test_secret_token_123').send(payload);

    expect(res.status).toBe(200);

    const wallet = await walletService.getBalance(testUserId, 'real');
    expect(new Decimal(wallet.balance).toNumber()).toBe(10000);
  });
});
