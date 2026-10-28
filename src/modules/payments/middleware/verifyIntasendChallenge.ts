import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../../shared/middleware/logger.js';

export function verifyIntasendChallenge(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTASEND_WEBHOOK_CHALLENGE;

  if (!expected || String(expected).trim() === '') {
    logger.error('INTASEND_WEBHOOK_CHALLENGE is not configured in environment', {
      correlationId: (req as any).correlationId,
    });
    res.status(500).json({ error: 'Server configuration error: INTASEND_WEBHOOK_CHALLENGE is not set' });
    return;
  }

  const actual = req.body?.challenge;
  if (!actual || String(actual).trim() === '') {
    logger.warn('IntaSend webhook challenge missing or empty in request', {
      correlationId: (req as any).correlationId,
    });
    res.status(401).json({ error: 'Invalid challenge' });
    return;
  }

  const expectedBuf = Buffer.from(String(expected));
  const actualBuf = Buffer.from(String(actual));

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    logger.warn('IntaSend webhook challenge mismatch', {
      correlationId: (req as any).correlationId,
    });
    res.status(401).json({ error: 'Invalid challenge' });
    return;
  }

  next();
}
