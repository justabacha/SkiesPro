import { PaymentService } from '../../src/modules/payments/services/paymentService.js';
import { WalletService } from '../../src/modules/wallet/services/walletService.js';
import { AdminComplianceService } from '../../src/modules/admin/services/AdminComplianceService.js';
import { pgPool } from '../../src/config/database.js';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';

describe('Slice 3 Real Manual DB Verification Output Generator', () => {
  let paymentService: PaymentService;
  let walletService: WalletService;
  let adminService: AdminComplianceService;
  let adminUserId: string;
  let userId: string;
  let ik: string;

  beforeAll(() => {
    paymentService = new PaymentService();
    walletService = new WalletService();
    adminService = new AdminComplianceService();
  });

  afterAll(async () => {
    try {
      if (userId) {
        await pgPool.query('DELETE FROM payments.b2c_outbox WHERE withdrawal_id IN (SELECT id FROM payments.withdrawals WHERE user_id = $1)', [userId]);
        await pgPool.query('DELETE FROM payments.withdrawals WHERE user_id = $1', [userId]);
        if (ik) {
          await pgPool.query('DELETE FROM payments.idempotency_keys WHERE key = $1', [ik]);
        }
        await pgPool.query('DELETE FROM wallet.ledger_entries WHERE wallet_id IN (SELECT id FROM wallet.wallets WHERE user_id = $1)', [userId]);
        await pgPool.query('DELETE FROM wallet.wallets WHERE user_id = $1', [userId]);
        await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [userId]);
      }
      if (adminUserId) {
        await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [adminUserId]);
      }
    } catch (err) {
      console.error('Cleanup error in slice3ManualVerification:', err);
    }
  });

  test('generate real DB query outputs for Slice 3 report', async () => {
    const adminEmail = `admin-verify-${Date.now()}-${Math.random()}@example.com`;
    const adminPhone = `078${Math.floor(1000000 + Math.random() * 9000000)}`;
    const adminRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Verify Admin', 'active', 'verified', $2) RETURNING id",
      [adminEmail, adminPhone]
    );
    adminUserId = adminRes.rows[0].id;

    const userEmail = `user-verify-${Date.now()}-${Math.random()}@example.com`;
    const userPhone = `077${Math.floor(1000000 + Math.random() * 9000000)}`;
    const userRes = await pgPool.query(
      "INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone) VALUES ($1, 'hash', 'Verify User', 'active', 'verified', $2) RETURNING id",
      [userEmail, userPhone]
    );
    userId = userRes.rows[0].id;

    await walletService.createWallet(userId, 'real', 'KES');
    await walletService.credit(userId, 'real', new Decimal('10000'), 'admin_adjustment', uuidv4(), 'Verification Funding');

    ik = uuidv4();
    const wReq = await paymentService.requestWithdrawal(userId, {
      amount: '3000',
      currency: 'KES',
      gateway_id: 1,
      phone: `+254${userPhone.substring(1)}`
    }, ik);

    console.log('REAL WITHDRAWAL ID CREATED:', wReq.id);

    const approvalRes = await adminService.approveWithdrawal(wReq.id, adminUserId, 'Verification approval note');
    console.log('APPROVAL RETURN VALUE:', JSON.stringify(approvalRes, null, 2));

    const res1 = await pgPool.query(
      "SELECT id, status, reviewed_by, gateway_reference FROM payments.withdrawals WHERE id = $1",
      [wReq.id]
    );
    console.log('VERBATIM QUERY 1 (payments.withdrawals):');
    console.log(JSON.stringify(res1.rows, null, 2));

    const res2 = await pgPool.query(
      "SELECT id, status, attempt_count, payload FROM payments.b2c_outbox WHERE withdrawal_id = $1",
      [wReq.id]
    );
    console.log('VERBATIM QUERY 2 (payments.b2c_outbox):');
    console.log(JSON.stringify(res2.rows, null, 2));

    const res3 = await pgPool.query(
      "SELECT w.user_id, w.balance, w.locked_balance FROM wallet.wallets w JOIN payments.withdrawals wd ON wd.user_id = w.user_id WHERE wd.id = $1 AND w.account_type = 'real'",
      [wReq.id]
    );
    console.log('VERBATIM QUERY 3 (wallet.wallets):');
    console.log(JSON.stringify(res3.rows, null, 2));

    expect(res1.rows[0].status).toBe('dispatched');
    expect(res2.rows[0].status).toBe('pending');
    expect(res3.rows[0].balance).toBe('10000.0000');
    expect(res3.rows[0].locked_balance).toBe('3000.0000');
  });
});
