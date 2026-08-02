import { Request, Response, NextFunction } from 'express';

interface LogContext {
  correlationId: string;
  module?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
  [key: string]: any;
}

const SECRET_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /bearer/i,
  /api[_-]?key/i,
  /consumer[_-]?(key|secret)/i,
  /passkey/i,
];

function scrubSecrets(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubSecrets(item));
  }

  const scrubbed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    const isSecret = SECRET_PATTERNS.some((pattern) => pattern.test(keyLower));
    
    if (isSecret && typeof value === 'string') {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      scrubbed[key] = scrubSecrets(value);
    } else {
      scrubbed[key] = value;
    }
  }
  return scrubbed;
}

/* eslint-disable no-console */
export const logger = {
  info: (message: string, context: Partial<LogContext> = {}): void => {
    const scrubbedContext = scrubSecrets(context);
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...scrubbedContext,
    };
    console.log(JSON.stringify(logEntry));
  },

  error: (message: string, context: Partial<LogContext> = {}): void => {
    const scrubbedContext = scrubSecrets(context);
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      ...scrubbedContext,
    };
    console.error(JSON.stringify(logEntry));
  },

  warn: (message: string, context: Partial<LogContext> = {}): void => {
    const scrubbedContext = scrubSecrets(context);
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      ...scrubbedContext,
    };
    console.warn(JSON.stringify(logEntry));
  },

  debug: (message: string, context: Partial<LogContext> = {}): void => {
    const scrubbedContext = scrubSecrets(context);
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      ...scrubbedContext,
    };
    console.log(JSON.stringify(logEntry));
  },
};
/* eslint-enable no-console */

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      module: 'http',
    });
  });

  next();
};
