import { PaymentRepository, DepositRow } from '../repositories/paymentRepository';
import { WalletService } from '../../wallet/services/walletService';
import { UserRepository } from '../../auth/repositories/userRepository';
import { MpesaGatewayFactory } from '../adapters/mpesa/MpesaGatewayFactory';
import { pgPool } from '../../../config/database';
import { Decimal } from 'decimal.js';
import {
  DepositInitiateDto,
  DepositResponseDto,
  WithdrawRequestDto,
  WithdrawResponseDto
} from '../dto/payment.dto';
import { logger } from '../../../shared/middleware/logger';

export class PaymentService {
  private paymentRepo: PaymentRepository;
  private userRepo: UserRepository;

  constructor() {
    this.paymentRepo = new PaymentRepository();
    this.userRepo = new UserRepository();
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, '');

    // Handle cases like +254..., 254..., 07..., 7...
    if (digits.startsWith('254') && digits.length === 12) {
      return digits;
    } else if (digits.startsWith('0') && digits.length === 10) {
      return `254${digits.substring(1)}`;
    } else if (digits.length === 9) {
      return `254${digits}`;
    }

    return digits;
  }

  async initiateDeposit(userId: string, data: DepositInitiateDto, idempotencyKey: string): Promise<DepositResponseDto> {
    const cached = await this.paymentRepo.findIdempotencyKey(idempotencyKey);
    if (cached && cached.status !== 'processing') return cached;

    const amount = new Decimal(data.amount);
    const minDeposit = new Decimal(process.env.MIN_DEPOSIT_KES || '500');
    const maxDeposit = new Decimal(process.env.MAX_DEPOSIT_KES || '100000');

    if (amount.lessThan(minDeposit)) {
      throw new Error(`Minimum deposit is ${minDeposit} KES`);
    }
    if (amount.greaterThan(maxDeposit)) {
      throw new Error(`Maximum deposit is ${maxDeposit} KES`);
    }

    // 1. Mark idempotency key as processing
    await this.paymentRepo.saveIdempotencyKey(idempotencyKey, { status: 'processing' });

    try {
      const gateway = MpesaGatewayFactory.getGateway();

      const rawPhone = data.phoneNumber || data.phone || '';
      const normalizedPhone = this.normalizePhoneNumber(rawPhone);

      if (!normalizedPhone || normalizedPhone.length < 10) {
        throw new Error('Valid phone number is required for STK Push');
      }

      // 2. Trigger STK Push
      const mpesaResponse = await gateway.initiateStkPush({
        userId,
        amount: amount.toNumber(),
        phone: normalizedPhone,
        idempotencyKey
      });

      // 3. Create pending deposit record
      const deposit = await this.paymentRepo.createDeposit({
        user_id: userId,
        gateway_id: data.gateway_id,
        gateway_reference: mpesaResponse.checkoutRequestId,
        amount: data.amount,
        fee: '0.0000',
        net_amount: data.amount,
        currency: data.currency,
        status: 'pending',
        webhook_payload: null,
        idempotency_key: idempotencyKey
      });

      const response: DepositResponseDto = {
        id: deposit.id,
        status: deposit.status,
        amount: deposit.amount,
        currency: deposit.currency,
        gateway_reference: deposit.gateway_reference
      };

      await this.paymentRepo.saveIdempotencyKey(idempotencyKey, response);
      return response;
    } catch (error: any) {
      logger.error('Deposit initiation failed', { error: error.message, userId, idempotencyKey });
      await this.paymentRepo.saveIdempotencyKey(idempotencyKey, null);
      throw error;
    }
  }

  async handleMpesaCallback(payload: any): Promise<void> {
    const stkCallback = payload.Body?.stkCallback;
    if (!stkCallback) {
      logger.error('Invalid M-Pesa callback payload', { payload });
      return;
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    logger.info('Received M-Pesa callback', { checkoutRequestId, resultCode, resultDesc });

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const paymentRepoTx = new PaymentRepository(client);
      const walletServiceTx = new WalletService(client);

      // Acquire lock on the deposit record
      const deposit = await paymentRepoTx.findDepositByReferenceForUpdate(checkoutRequestId);

      if (!deposit) {
        logger.warn('Deposit record not found for M-Pesa callback', { checkoutRequestId });
        await client.query('ROLLBACK');
        return;
      }

      // CRITICAL: Re-check status AFTER acquiring lock to prevent race condition
      if (deposit.status !== 'pending') {
        logger.info('Deposit already processed', { depositId: deposit.id, status: deposit.status });
        await client.query('ROLLBACK');
        return;
      }

      if (resultCode === 0) {
        // Success: Credit wallet
        await paymentRepoTx.updateDepositStatus(deposit.id, 'completed', payload);

        await walletServiceTx.credit(
          deposit.user_id,
          new Decimal(deposit.net_amount),
          'deposit',
          deposit.id,
          `M-Pesa Deposit: ${checkoutRequestId}`
        );

        logger.info('Deposit completed and wallet credited', { depositId: deposit.id, userId: deposit.user_id });
      } else {
        // Failure
        await paymentRepoTx.updateDepositStatus(deposit.id, 'failed', payload);
        logger.info('Deposit marked as failed', { depositId: deposit.id, resultCode });
      }

      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to process M-Pesa callback', { error: error.message, checkoutRequestId });
      throw error;
    } finally {
      client.release();
    }
  }

  async requestWithdrawal(userId: string, data: WithdrawRequestDto, idempotencyKey: string): Promise<WithdrawResponseDto> {
    const cached = await this.paymentRepo.findIdempotencyKey(idempotencyKey);
    if (cached && cached.status !== 'processing') return cached;

    const user = await this.userRepo.findById(userId);
    if (!user || user.kyc_status !== 'verified') {
      throw new Error('KYC verification required for withdrawals');
    }

    const amount = new Decimal(data.amount);
    const minWithdrawal = new Decimal(process.env.MIN_WITHDRAWAL_KES || '1500');
    const maxWithdrawal = new Decimal(process.env.MAX_WITHDRAWAL_KES || '60000');

    if (amount.lessThan(minWithdrawal)) {
      throw new Error(`Minimum withdrawal is ${minWithdrawal} KES`);
    }
    if (amount.greaterThan(maxWithdrawal)) {
      throw new Error(`Maximum daily withdrawal is ${maxWithdrawal} KES`);
    }

    const feePercent = new Decimal(process.env.WITHDRAWAL_FEE_PERCENT || '2').div(100);
    const fee = amount.mul(feePercent).toDecimalPlaces(4);
    const netAmount = amount.minus(fee);

    await this.paymentRepo.saveIdempotencyKey(idempotencyKey, { status: 'processing' });

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const walletServiceTx = new WalletService(client);
      const paymentRepoTx = new PaymentRepository(client);

      await walletServiceTx.lockFunds(userId, amount, 'withdrawal', undefined, 'Withdrawal request lock');

      const withdrawal = await paymentRepoTx.createWithdrawal({
        user_id: userId,
        gateway_id: data.gateway_id,
        amount: data.amount,
        fee: fee.toString(),
        net_amount: netAmount.toString(),
        currency: data.currency,
        status: 'pending',
        idempotency_key: idempotencyKey
      });

      const response: WithdrawResponseDto = {
        id: withdrawal.id,
        status: withdrawal.status,
        amount: withdrawal.amount,
        fee: withdrawal.fee,
        net_amount: withdrawal.net_amount,
        currency: withdrawal.currency
      };

      await paymentRepoTx.saveIdempotencyKey(idempotencyKey, response);

      await client.query('COMMIT');
      return response;
    } catch (error: any) {
      await client.query('ROLLBACK');
      await this.paymentRepo.saveIdempotencyKey(idempotencyKey, null);
      throw error;
    } finally {
      client.release();
    }
  }

  async getDepositStatus(id: string): Promise<DepositRow> {
    const deposit = await pgPool.query('SELECT * FROM payments.deposits WHERE id = $1', [id]);
    if (deposit.rowCount === 0) throw new Error('Deposit not found');
    return deposit.rows[0];
  }

  async syncDepositStatus(id: string): Promise<DepositRow> {
    const deposit = await this.getDepositStatus(id);
    if (deposit.status !== 'pending') return deposit;

    const gateway = MpesaGatewayFactory.getGateway();
    try {
      const status = await gateway.queryTransactionStatus(deposit.gateway_reference);

      // If Safaricom confirms success, but we haven't processed it yet
      if (status.resultCode === '0') {
        const payload = {
          Body: {
            stkCallback: {
              CheckoutRequestID: deposit.gateway_reference,
              ResultCode: 0,
              ResultDesc: status.resultDesc,
              // Metadata is missing from query status but we can use the original deposit info
            }
          }
        };
        await this.handleMpesaCallback(payload);
      } else if (status.resultCode !== '1032' && status.resultCode !== 'pending') {
        // Mark as failed if Safaricom says it failed (except for specific pending codes)
        await this.paymentRepo.updateDepositStatus(deposit.id, 'failed', status);
      }

      return this.getDepositStatus(id);
    } catch (error: any) {
      logger.error('Failed to sync deposit status', { error: error.message, depositId: id });
      return deposit;
    }
  }
}
