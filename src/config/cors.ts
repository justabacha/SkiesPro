import cors from 'cors';
import { config } from './app';

export const corsOptions = {
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

export const corsMiddleware = cors(corsOptions);
