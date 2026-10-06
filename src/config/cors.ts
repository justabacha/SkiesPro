import cors, { CorsOptions } from 'cors';
import { config } from './app.js';

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsOrigin.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'X-Admin-MFA-Token',
    'Authorization',
    'Content-Type',
    'Idempotency-Key',
    'X-Request-ID',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200,
};

export const corsMiddleware = cors(corsOptions);
