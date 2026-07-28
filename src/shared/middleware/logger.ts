import { Request, Response, NextFunction } from 'express';

interface LogContext {
  correlationId: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  error?: string;
}

export const logger = {
  info: (message: string, context: Partial<LogContext> = {}): void => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...context,
    };
    console.log(JSON.stringify(logEntry));
  },

  error: (message: string, context: Partial<LogContext> = {}): void => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      ...context,
    };
    console.error(JSON.stringify(logEntry));
  },

  warn: (message: string, context: Partial<LogContext> = {}): void => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      ...context,
    };
    console.warn(JSON.stringify(logEntry));
  },
};

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request', {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
};
