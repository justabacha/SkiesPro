import { PaymentRepository, DepositRow } from '../repositories/paymentRepository.js';
import { WalletService } from '../../wallet/services/walletService.js';
import { UserRepository } from '../../auth/repositories/userRepository.js';
import { MpesaGatewayFactory } from '../adapters/mpesa/MpesaGatewayFactory.js';
import { pgPool } from '../../../config/database.js';
import { Decimal } from 'decimal.js';
import {
  DepositInitiateDto,
  DepositResponseDto,
  WithdrawRequestDto,
  WithdrawResponseDto,
} from '../dto/payment.dto.js';
import { logger } from '../../../shared/middleware/logger.js';

export class PaymentService {
  private paymentRepo: PaymentRepository;
  private userRepo: UserRepository;

  constructor() {
    this.paymentRepo = new PaymentRepository();
    this.userRepo = new UserRepository();
  }

  async initiateDeposit(
    userId: string,
    data: DepositInitiateDto,
    idempotencyKey: string
  ): Promise<DepositResponseDto> {
    const cached = await this.paymentRepo.findIdempotencyKey(idempotencyKey);
    if (cached && cached.status !== 'processing') return cached;

    const amount = new Decimal(data.amount);
    const minDeposit = new Decimal(process.env.MIN_DEPOSIT_KES || '100');
    if (amount.lessThan(minDeposit)) {
      throw new Error(`Minimum deposit is ${minDeposit} KES`);
    }

    await this.paymentRepo.saveIdempotencyKey(idempotencyKey, { status: 'processing' });

    try {
      const gateway = MpesaGatewayFactory.getGateway();
      const phone = data.phone || data.phoneNumber;
      if (!phone) throw new Error('Phone number is required');

      const stkResponse = await gateway.initiateStkPush({
        userId,
        amount: amount.toNumber(),
        phone,
        idempotencyKey,
      });

      const fee = new Decimal(0);
      const netAmount = amount.minus(fee);

      const deposit = await this.paymentRepo.createDeposit({
        user_id: userId,
        gateway_id: data.gateway_id,
        gateway_reference: stkResponse.checkoutRequestId,
        amount: data.amount,
        fee: fee.toString(),
        net_amount: netAmount.toString(),
        currency: data.currency,
        status: 'pending',
        webhook_payload: null,
        idempotency_key: idempotencyKey,
      });

      const response: DepositResponseDto = {
        id: deposit.id,
        status: deposit.status,
        amount: deposit.amount,
        currency: deposit.currency,
        gateway_reference: deposit.gateway_reference,
        customer_message: stkResponse.customerMessage,
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

      const deposit = await paymentRepoTx.findDepositByReferenceForUpdate(checkoutRequestId);

      if (!deposit) {
        logger.warn('Deposit record not found for M-Pesa callback', { checkoutRequestId });
        await client.query('ROLLBACK');
        return;
      }

      if (deposit.status !== 'pending') {
        logger.info('Deposit already processed', { depositId: deposit.id, status: deposit.status });
        await client.query('ROLLBACK');
        return;
      }

      if (resultCode === 0) {
        await paymentRepoTx.updateDepositStatus(deposit.id, 'completed', payload);

        await walletServiceTx.credit(
          deposit.user_id,
          new Decimal(deposit.net_amount),
          'deposit',
          deposit.id,
          `M-Pesa Deposit: ${checkoutRequestId}`
        );

        logger.info('Deposit completed and wallet credited', {
          depositId: deposit.id,
          userId: deposit.user_id,
        });
      } else {
        await paymentRepoTx.updateDepositStatus(deposit.id, 'failed', payload);
        logger.info('Deposit marked as failed', { depositId: deposit.id, resultCode });
      }

      await client.query('COMMIT');
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error('Failed to process M-Pesa callback', {
        error: error.message,
        checkoutRequestId,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async requestWithdrawal(
    userId: string,
    data: WithdrawRequestDto,
    idempotencyKey: string
  ): Promise<WithdrawResponseDto> {
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

      await walletServiceTx.lockFunds(
        userId,
        amount,
        'withdrawal',
        undefined,
        'Withdrawal request lock'
      );

      const withdrawal = await paymentRepoTx.createWithdrawal({
        user_id: userId,
        gateway_id: data.gateway_id,
        amount: data.amount,
        fee: fee.toString(),
        net_amount: netAmount.toString(),
        currency: data.currency,
        status: 'pending',
        idempotency_key: idempotencyKey,
      });

      const response: WithdrawResponseDto = {
        id: withdrawal.id,
        status: withdrawal.status,
        amount: withdrawal.amount,
        fee: withdrawal.fee,
        net_amount: withdrawal.net_amount,
        currency: withdrawal.currency,
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

      if (status.resultCode === '0') {
        const payload = {
          Body: {
            stkCallback: {
              CheckoutRequestID: deposit.gateway_reference,
              ResultCode: 0,
              ResultDesc: status.resultDesc,
            },
          },
        };
        await this.handleMpesaCallback(payload);
      } else if (status.resultCode !== '1032' && status.resultCode !== 'pending') {
        await this.paymentRepo.updateDepositStatus(deposit.id, 'failed', status);
      }

      return this.getDepositStatus(id);
    } catch (error: any) {
      logger.error('Failed to sync deposit status', { error: error.message, depositId: id });
      return deposit;
    }
  }
}
