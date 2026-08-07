import { logger } from '../../../shared/middleware/logger';

export class EmailVerificationWorker {
  async process(userId: string, email: string, token: string): Promise<void> {
    // Placeholder for actual email sending logic
    logger.info('EmailVerificationWorker: Sending verification email', {
      userId,
      email,
      token,
    });

    // Logic to send email would go here (e.g. SMTP, AWS SES, Africa's Talking)
  }
}

export const emailVerificationWorker = new EmailVerificationWorker();
