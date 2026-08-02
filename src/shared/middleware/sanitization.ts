import { Request, Response, NextFunction } from 'express';
import { body, validationResult, param, query } from 'express-validator';

export const validateBody = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(schema.map((validation: any) => validation.run(req)));
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation Error',
        details: errors.array(),
      });
      return;
    }

    next();
  };
};

export const validateParams = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(schema.map((validation: any) => validation.run(req)));
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation Error',
        details: errors.array(),
      });
      return;
    }

    next();
  };
};

export const validateQuery = (schema: any) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(schema.map((validation: any) => validation.run(req)));
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation Error',
        details: errors.array(),
      });
      return;
    }

    next();
  };
};

export const sanitizeString = (value: any): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/[<>]/g, '');
};

export const sanitizeNumber = (value: any): number => {
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

export const sanitizeEmail = (value: any): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};
