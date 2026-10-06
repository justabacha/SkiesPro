import { Request, Response } from 'express';
import { WalletService } from '../services/walletService.js';
import { LedgerRepository } from '../repositories/ledgerRepository.js';
import { logger } from '../../../shared/middleware/logger.js';

export class WalletController {
  private walletService: WalletService;
  private ledgerRepo: LedgerRepository;

  constructor() {
    this.walletService = new WalletService();
    this.ledgerRepo = new LedgerRepository();
  }

  async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const wallet = await this.walletService.getBalance(userId, 'real');

      res.status(200).json({
        data: {
          balance: wallet.balance,
          locked_balance: wallet.locked_balance,
          available_balance: wallet.available_balance,
          currency: wallet.currency,
        },
        meta: { request_id: req.correlationId },
      });
    } catch (error) {
      logger.error('Failed to get balance', { error: (error as Error).message });
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getAllWallets(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const realWallet = await this.walletService.getBalance(userId, 'real').catch(() => null);
      const demoWallet = await this.walletService.getBalance(userId, 'demo').catch(() => null);

      res.status(200).json({
        data: {
          real: realWallet
            ? {
                id: realWallet.id,
                balance: realWallet.balance,
                locked_balance: realWallet.locked_balance,
                available_balance: realWallet.available_balance,
                currency: realWallet.currency,
                account_type: 'real',
              }
            : null,
          demo: demoWallet
            ? {
                id: demoWallet.id,
                balance: demoWallet.balance,
                locked_balance: demoWallet.locked_balance,
                available_balance: demoWallet.available_balance,
                currency: demoWallet.currency,
                account_type: 'demo',
              }
            : null,
          wallets: [realWallet, demoWallet].filter(Boolean),
        },
        meta: { request_id: req.correlationId },
      });
    } catch (error) {
      logger.error('Failed to get all wallets', { error: (error as Error).message });
      res.status(400).json({ error: (error as Error).message });
    }
  }

  async getLedger(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const { limit, cursor } = req.query;

      const wallet = await this.walletService.getBalance(userId, 'real');
      const entries = await this.ledgerRepo.findByWalletId(
        wallet.id,
        limit ? parseInt(limit as string, 10) : 20,
        cursor as string
      );

      const nextCursor =
        entries.length > 0 ? entries[entries.length - 1].created_at.toISOString() : undefined;

      res.status(200).json({
        data: entries,
        meta: {
          next_cursor: nextCursor,
          has_more: entries.length === (limit ? parseInt(limit as string, 10) : 20),
          request_id: req.correlationId,
        },
      });
    } catch (error) {
      logger.error('Failed to get ledger', { error: (error as Error).message });
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
