import { PaymentRepository } from '../repositories/paymentRepository';
import { WalletService } from '../../wallet/services/walletService';
import { UserRepository } from '../../auth/repositories/userRepository';
import { pgPool } from '../../../config/database';
import { Decimal } from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import {
  DepositInitiateDto,
  DepositResponseDto,
  WithdrawRequestDto,
  WithdrawResponseDto,
} from '../dto/payment.dto';

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
    if (cached) return cached;

    const amount = new Decimal(data.amount);
    const minDeposit = new Decimal(process.env.MIN_DEPOSIT_KES || '500');

    if (amount.lessThan(minDeposit)) {
      throw new Error(`Minimum deposit is ${minDeposit} KES`);
    }

    const gatewayReference = `DEP-${uuidv4().split('-')[0].toUpperCase()}`;

    // 1. Create idempotency key first to satisfy FK if exists (and prevent concurrent same key)
    await this.paymentRepo.saveIdempotencyKey(idempotencyKey, { status: 'processing' });

    const deposit = await this.paymentRepo.createDeposit({
      user_id: userId,
      gateway_id: data.gateway_id,
      gateway_reference: gatewayReference,
      amount: data.amount,
      fee: '0.0000',
      net_amount: data.amount,
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
    };

    await this.paymentRepo.saveIdempotencyKey(idempotencyKey, response);
    return response;
  }

  async requestWithdrawal(
    userId: string,
    data: WithdrawRequestDto,
    idempotencyKey: string
  ): Promise<WithdrawResponseDto> {
    const cached = await this.paymentRepo.findIdempotencyKey(idempotencyKey);
    if (cached && cached.status !== 'processing') return cached;

    // 1. Check KYC
    const user = await this.userRepo.findById(userId);
    if (!user || user.kyc_status !== 'verified') {
      throw new Error('KYC verification required for withdrawals');
    }

    // 2. Validate amount
    const amount = new Decimal(data.amount);
    const minWithdrawal = new Decimal(process.env.MIN_WITHDRAWAL_KES || '1500');
    if (amount.lessThan(minWithdrawal)) {
      throw new Error(`Minimum withdrawal is ${minWithdrawal} KES`);
    }

    // 3. Calculate fee
    const feePercent = new Decimal(process.env.WITHDRAWAL_FEE_PERCENT || '2').div(100);
    const fee = amount.mul(feePercent).toDecimalPlaces(4);
    const netAmount = amount.minus(fee);

    // 4. Create idempotency key
    await this.paymentRepo.saveIdempotencyKey(idempotencyKey, { status: 'processing' });

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const walletServiceTx = new WalletService(client);
      const paymentRepoTx = new PaymentRepository(client);

      // 5. Check available balance and lock funds
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
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
