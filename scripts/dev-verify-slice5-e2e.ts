/**
 * Developer Verification Helper — Slice 5 B2C Recovery E2E Flows
 *
 * Purpose: Executed during development to verify end-to-end functionality
 * of B2C Retry, Force Complete, and Force Refund service methods directly against
 * the database with proper cleanup.
 *
 * Usage: npx tsx scripts/dev-verify-slice5-e2e.ts
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../src/config/database.js';
import { WalletService } from '../src/modules/wallet/services/walletService.js';
import { AdminComplianceService } from '../src/modules/admin/services/AdminComplianceService.js';

async function runVerification() {
  console.log('=== STARTING SLICE 5 REAL E2E VERIFICATIONS ===');

  const walletService = new WalletService();
  const complianceService = new AdminComplianceService();

  // Create admin
  const adminEmail = `e2e-admin-${Date.now()}@example.com`;
  const adminRes = await pgPool.query(
    "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'E2E Admin', 'active', 'verified', '0799998888') RETURNING id",
    [adminEmail]
  );
  const adminUserId = adminRes.rows[0].id;

  // Create user
  const userEmail = `e2e-user-${Date.now()}@example.com`;
  const userRes = await pgPool.query(
    "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'E2E User', 'active', 'verified', '254712345678') RETURNING id",
    [userEmail]
  );
  const testUserId = userRes.rows[0].id;
  await walletService.createWallet(testUserId, 'real', 'KES');

  const cleanups: () => Promise<void> = async () => {
    await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [testUserId]);
    await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [testUserId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id IN ($1, $2)', [testUserId, adminUserId]);
  };

  try {
    // Helper to seed idempotency key
    const seedIdempotencyKey = async () => {
      const key = `idemp-${uuidv4()}`;
      await pgPool.query("INSERT INTO payments.idempotency_keys (key, response) VALUES ($1, '{}'::jsonb) ON CONFLICT DO NOTHING", [key]);
      return key;
    };

    // --- 1. RETRY E2E ---
    console.log('\n--- 1. RETRY E2E VERIFICATION ---');
    await pgPool.query("UPDATE wallet.wallets SET balance = 10000, locked_balance = 0 WHERE user_id = $1 AND account_type = 'real'", [testUserId]);

    const retryIdemp = await seedIdempotencyKey();
    const wRetryRes = await pgPool.query(
      `INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, 3000, 60, 2940, 'KES', 'failed', $2)
       RETURNING id`,
      [testUserId, retryIdemp]
    );
    const retryWId = wRetryRes.rows[0].id;

    const oRetryRes = await pgPool.query(
      `INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, retry_count, payload, created_at, updated_at)
       VALUES ($1, $2, 'failed', 0, $3::jsonb, NOW(), NOW())
       RETURNING id`,
      [retryWId, uuidv4(), JSON.stringify({ amount: '3000', netAmount: '2940', recipientPhone: '254712345678' })]
    );
    const retryOId = oRetryRes.rows[0].id;

    console.log(`Executing retryWithdrawal for ${retryWId}...`);
    const retryResult = await complianceService.retryWithdrawal(retryWId, adminUserId);
    console.log('Retry Result:', JSON.stringify(retryResult, null, 2));

    const dbRetryW = await pgPool.query('SELECT id, status, review_note, reviewed_by FROM payments.withdrawals WHERE id = $1', [retryWId]);
    console.log('\nDB Query: payments.withdrawals (Retry):');
    console.log(JSON.stringify(dbRetryW.rows, null, 2));

    const dbRetryO = await pgPool.query('SELECT id, status, retry_count, needs_manual_review, manual_review_reason, originator_conversation_id FROM payments.b2c_outbox WHERE id = $1', [retryOId]);
    console.log('\nDB Query: payments.b2c_outbox (Retry):');
    console.log(JSON.stringify(dbRetryO.rows, null, 2));

    const dbRetryWallet = await pgPool.query('SELECT balance, locked_balance, available_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = \'real\'', [testUserId]);
    console.log('\nDB Query: wallet.wallets (Retry):');
    console.log(JSON.stringify(dbRetryWallet.rows, null, 2));

    // Cleanup retry rows
    await pgPool.query('DELETE FROM payments.b2c_outbox WHERE id = $1', [retryOId]);
    await pgPool.query('DELETE FROM payments.withdrawals WHERE id = $1', [retryWId]);
    await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = $1', [retryIdemp]);

    // --- 2. FORCE COMPLETE E2E ---
    console.log('\n--- 2. FORCE COMPLETE E2E VERIFICATION ---');
    await pgPool.query("UPDATE wallet.wallets SET balance = 10000, locked_balance = 3000 WHERE user_id = $1 AND account_type = 'real'", [testUserId]);

    const compIdemp = await seedIdempotencyKey();
    const wCompRes = await pgPool.query(
      `INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, 3000, 60, 2940, 'KES', 'dispatched', $2)
       RETURNING id`,
      [testUserId, compIdemp]
    );
    const compWId = wCompRes.rows[0].id;

    const oCompRes = await pgPool.query(
      `INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, needs_manual_review, manual_review_reason, payload, created_at, updated_at)
       VALUES ($1, $2, 'sent', true, 'Stuck at 2h threshold', $3::jsonb, NOW(), NOW())
       RETURNING id`,
      [compWId, uuidv4(), JSON.stringify({ amount: '3000', netAmount: '2940', recipientPhone: '254712345678' })]
    );
    const compOId = oCompRes.rows[0].id;

    console.log(`Executing forceCompleteWithdrawal for ${compWId}...`);
    const compResult = await complianceService.forceCompleteWithdrawal(compWId, adminUserId, 'QGH782103K', 'Ops manual completion');
    console.log('Force Complete Result:', JSON.stringify(compResult, null, 2));

    const dbCompW = await pgPool.query('SELECT id, status, gateway_reference, review_note, reviewed_by FROM payments.withdrawals WHERE id = $1', [compWId]);
    console.log('\nDB Query: payments.withdrawals (Force Complete):');
    console.log(JSON.stringify(dbCompW.rows, null, 2));

    const dbCompO = await pgPool.query('SELECT id, status, processed_at, needs_manual_review, manual_review_reason FROM payments.b2c_outbox WHERE id = $1', [compOId]);
    console.log('\nDB Query: payments.b2c_outbox (Force Complete):');
    console.log(JSON.stringify(dbCompO.rows, null, 2));

    const dbCompWallet = await pgPool.query('SELECT balance, locked_balance, available_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = \'real\'', [testUserId]);
    console.log('\nDB Query: wallet.wallets (Force Complete):');
    console.log(JSON.stringify(dbCompWallet.rows, null, 2));

    // Cleanup force-complete rows
    await pgPool.query('DELETE FROM payments.b2c_outbox WHERE id = $1', [compOId]);
    await pgPool.query('DELETE FROM payments.withdrawals WHERE id = $1', [compWId]);
    await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = $1', [compIdemp]);

    // --- 3. FORCE REFUND E2E ---
    console.log('\n--- 3. FORCE REFUND E2E VERIFICATION ---');
    await pgPool.query("UPDATE wallet.wallets SET balance = 10000, locked_balance = 3000 WHERE user_id = $1 AND account_type = 'real'", [testUserId]);

    const refIdemp = await seedIdempotencyKey();
    const wRefRes = await pgPool.query(
      `INSERT INTO payments.withdrawals (user_id, gateway_id, amount, fee, net_amount, currency, status, idempotency_key)
       VALUES ($1, 1, 3000, 60, 2940, 'KES', 'dispatched', $2)
       RETURNING id`,
      [testUserId, refIdemp]
    );
    const refWId = wRefRes.rows[0].id;

    const oRefRes = await pgPool.query(
      `INSERT INTO payments.b2c_outbox (withdrawal_id, originator_conversation_id, status, needs_manual_review, manual_review_reason, payload, created_at, updated_at)
       VALUES ($1, $2, 'sent', true, 'Stuck at 2h threshold', $3::jsonb, NOW(), NOW())
       RETURNING id`,
      [refWId, uuidv4(), JSON.stringify({ amount: '3000', netAmount: '2940', recipientPhone: '254712345678' })]
    );
    const refOId = oRefRes.rows[0].id;

    console.log(`Executing forceRefundWithdrawal for ${refWId}...`);
    const refResult = await complianceService.forceRefundWithdrawal(refWId, adminUserId, 'Daraja system error confirmed by support');
    console.log('Force Refund Result:', JSON.stringify(refResult, null, 2));

    const dbRefW = await pgPool.query('SELECT id, status, review_note, reviewed_by FROM payments.withdrawals WHERE id = $1', [refWId]);
    console.log('\nDB Query: payments.withdrawals (Force Refund):');
    console.log(JSON.stringify(dbRefW.rows, null, 2));

    const dbRefO = await pgPool.query('SELECT id, status, last_error, processed_at, needs_manual_review, manual_review_reason FROM payments.b2c_outbox WHERE id = $1', [refOId]);
    console.log('\nDB Query: payments.b2c_outbox (Force Refund):');
    console.log(JSON.stringify(dbRefO.rows, null, 2));

    const dbRefWallet = await pgPool.query('SELECT balance, locked_balance, available_balance FROM wallet.wallets WHERE user_id = $1 AND account_type = \'real\'', [testUserId]);
    console.log('\nDB Query: wallet.wallets (Force Refund):');
    console.log(JSON.stringify(dbRefWallet.rows, null, 2));

    // Cleanup force-refund rows
    await pgPool.query('DELETE FROM payments.b2c_outbox WHERE id = $1', [refOId]);
    await pgPool.query('DELETE FROM payments.withdrawals WHERE id = $1', [refWId]);
    await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = $1', [refIdemp]);

    // --- 4. HISTORICAL RECORD CHECK ---
    console.log('\n--- 4. HISTORICAL WITHDRAWAL RECORD CHECK ---');
    const histRes = await pgPool.query("SELECT id, status, reviewed_by FROM payments.withdrawals WHERE id = '235d9ef4-8cde-42c9-be63-9accc9ac09d0'");
    console.log('DB Query: Historical Withdrawal 235d9ef4-8cde-42c9-be63-9accc9ac09d0:');
    console.log(JSON.stringify(histRes.rows, null, 2));

  } finally {
    await cleanups();
    await pgPool.end();
  }
  console.log('\n=== E2E VERIFICATIONS COMPLETE ===');
}

runVerification().catch((err) => {
  console.error('E2E Verification failed:', err);
  process.exit(1);
});
