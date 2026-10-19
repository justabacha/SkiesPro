import dotenv from 'dotenv';

dotenv.config();

const parseCorsOrigins = (): string[] => {
  const raw =
    process.env.CORS_ORIGIN ||
    'http://localhost:5173,http://localhost:3000,https://skies-pro.vercel.app';
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
  enablePriceFeed: process.env.ENABLE_PRICE_FEED === 'true',
  enableSettlementWorker: process.env.ENABLE_SETTLEMENT_WORKER === 'true',
  useMockPrices: process.env.USE_MOCK_PRICES === 'true',
  enableB2cDisbursement: process.env.ENABLE_B2C_DISBURSEMENT === 'true',
  enableB2cWorker: process.env.ENABLE_B2C_WORKER === 'true',
  b2cWorkerIntervalMs: parseInt(process.env.B2C_WORKER_INTERVAL_MS || '5000', 10),
  b2cWorkerBatchSize: parseInt(process.env.B2C_WORKER_BATCH_SIZE || '5', 10),
  b2c: {
    shortcode: process.env.MPESA_B2C_SHORTCODE || '',
    initiatorName: process.env.MPESA_B2C_INITIATOR_NAME || '',
    securityCredential: process.env.MPESA_B2C_SECURITY_CREDENTIAL || '',
    commandId: process.env.MPESA_B2C_COMMAND_ID || 'BusinessPayment',
    resultUrl: process.env.MPESA_B2C_RESULT_URL || '',
    timeoutUrl: process.env.MPESA_B2C_TIMEOUT_URL || '',
  },
};

export function validateB2cConfig(): void {
  if (config.enableB2cDisbursement) {
    const requiredVars = [
      { name: 'MPESA_B2C_SHORTCODE', value: config.b2c.shortcode },
      { name: 'MPESA_B2C_INITIATOR_NAME', value: config.b2c.initiatorName },
      { name: 'MPESA_B2C_SECURITY_CREDENTIAL', value: config.b2c.securityCredential },
      { name: 'MPESA_B2C_RESULT_URL', value: config.b2c.resultUrl },
      { name: 'MPESA_B2C_TIMEOUT_URL', value: config.b2c.timeoutUrl },
    ];

    const missing = requiredVars.filter((v) => !v.value).map((v) => v.name);
    if (missing.length > 0) {
      throw new Error(
        `ENABLE_B2C_DISBURSEMENT is true but missing required env vars: ${missing.join(', ')}`
      );
    }
  }
}
