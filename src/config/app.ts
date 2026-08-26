import dotenv from 'dotenv';

dotenv.config();

const parseCorsOrigins = (): string[] => {
  const raw = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: parseCorsOrigins(),
  logLevel: process.env.LOG_LEVEL || 'info',
};
