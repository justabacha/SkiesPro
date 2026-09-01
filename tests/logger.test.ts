import { logger } from '../src/shared/middleware/logger.js';

describe('Logger', () => {
  describe('secret scrubbing', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should scrub password from context', () => {
      logger.info('Test message', { password: 'secret123' });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.password).toBe('[REDACTED]');
    });

    it('should scrub token from context', () => {
      logger.info('Test message', { token: 'abc123' });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.token).toBe('[REDACTED]');
    });

    it('should scrub secret from context', () => {
      logger.info('Test message', { secret: 'hidden' });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.secret).toBe('[REDACTED]');
    });

    it('should scrub api_key from context', () => {
      logger.info('Test message', { api_key: 'key123' });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.api_key).toBe('[REDACTED]');
    });

    it('should scrub consumer_key from context', () => {
      logger.info('Test message', { consumer_key: 'ck123' });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.consumer_key).toBe('[REDACTED]');
    });

    it('should scrub passkey from context', () => {
      logger.info('Test message', { passkey: 'pk123' });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.passkey).toBe('[REDACTED]');
    });

    it('should scrub nested secrets', () => {
      logger.info('Test message', { user: { password: 'secret123' } });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.user.password).toBe('[REDACTED]');
    });

    it('should scrub secrets in arrays', () => {
      logger.info('Test message', { items: [{ token: 'abc' }, { token: 'def' }] });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.items[0].token).toBe('[REDACTED]');
      expect(logEntry.items[1].token).toBe('[REDACTED]');
    });

    it('should not scrub non-secret fields', () => {
      logger.info('Test message', { username: 'test', email: 'test@example.com' });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.username).toBe('test');
      expect(logEntry.email).toBe('test@example.com');
    });

    it('should produce structured JSON logs', () => {
      logger.info('Test message', { correlationId: 'test-123' });
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe('info');
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.correlationId).toBe('test-123');
    });
  });

  describe('log levels', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should log info level', () => {
      logger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('info');
    });

    it('should log error level', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('error');
    });

    it('should log warn level', () => {
      logger.warn('Warn message');
      expect(consoleWarnSpy).toHaveBeenCalled();
      const logCall = consoleWarnSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('warn');
    });

    it('should log debug level', () => {
      logger.debug('Debug message');
      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0][0];
      const logEntry = JSON.parse(logCall);
      expect(logEntry.level).toBe('debug');
    });
  });
});
