import { logger } from '../../../shared/middleware/logger';

export class PasswordResetWorker {
  async process(email: string, token: string): Promise<void> {
    // Placeholder for actual email sending logic
    logger.info('PasswordResetWorker: Sending password reset email', {
      email,
      token,
    });

    // Logic to send email would go here
  }
}

export const passwordResetWorker = new PasswordResetWorker();
