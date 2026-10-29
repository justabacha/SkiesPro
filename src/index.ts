import express, { Application } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import { config, validateB2cConfig, validateIntasendConfig } from './config/app.js';
import { corsMiddleware } from './config/cors.js';
import { correlationIdMiddleware } from './shared/middleware/correlationId.js';
import { requestLogger } from './shared/middleware/logger.js';
import routes from './infrastructure/routes.js';
import { logger } from './shared/middleware/logger.js';
import { attachWebSocketServer } from './infrastructure/websocket/wsServer.js';
import { pgPool } from './config/database.js';

const app: Application = express();

// Trust Render Proxy
app.set('trust proxy', 1);
app.set('etag', false);

// CORS
app.use(corsMiddleware);
app.options('*', corsMiddleware);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cookieParser());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom middleware
app.use(correlationIdMiddleware);
app.use(requestLogger);

// Routes
app.use('/', routes);

// Process crash safeguards
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

const setCorsHeadersOnResponse = (req: express.Request, res: express.Response) => {
  const origin = req.headers.origin;
  const allowedOrigins = Array.from(
    new Set([
      'https://skiespro.co.ke',
      'https://www.skiespro.co.ke',
      'https://skies-pro.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      ...config.corsOrigin,
    ])
  );
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
};

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  setCorsHeadersOnResponse(req, res);
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    path: req.path,
  });
});

// Global Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  setCorsHeadersOnResponse(req, res);

  logger.error('Unhandled error', {
    correlationId: (req as any).correlationId,
    error: err?.message || String(err),
  });

  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err?.message || 'Internal Server Error',
    error: err?.message || 'Internal Server Error',
  });
});

const PORT = config.port;

// Create HTTP server for WebSocket attachment
const server = http.createServer(app);

// Attach WebSocket server
attachWebSocketServer(server);

let activeB2cWorker: any = null;
let activeB2cReconciliationJob: any = null;
let activeSettlementRecoveryJob: any = null;

const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  if (activeB2cWorker) {
    try {
      await activeB2cWorker.stop();
    } catch (err: any) {
      logger.error('Error stopping B2C dispatch worker', { error: err.message });
    }
  }
  if (activeB2cReconciliationJob) {
    try {
      await activeB2cReconciliationJob.stop();
    } catch (err: any) {
      logger.error('Error stopping B2C reconciliation job', { error: err.message });
    }
  }
  if (activeSettlementRecoveryJob) {
    try {
      await activeSettlementRecoveryJob.stop();
    } catch (err: any) {
      logger.error('Error stopping settlement recovery job', { error: err.message });
    }
  }
  server.close(() => {
    logger.info('HTTP server closed cleanly');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(0);
    }
  });
};

async function bootstrap(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    validateB2cConfig();
    if (process.env.PAYMENT_GATEWAY_MODE === 'INTASEND') {
      await validateIntasendConfig(pgPool);
    }

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    // Automatically start price feed if enabled
    if (config.enablePriceFeed) {
      import('./modules/pricing/bootstrap.js')
        .then((m) => m.bootstrapPriceFeed())
        .catch((err) => {
          logger.error('Failed to auto-start price feed', { error: err.message });
        });
    }

    if (process.env.DEMO_ENABLED === 'true') {
      import('./modules/pricing/services/DemoPriceFeedService.js')
        .then(({ demoPriceFeedService }) => demoPriceFeedService.start())
        .catch((err) => {
          logger.error('Failed to start isolated demo price feed', { error: err.message });
        });
    }

    // Automatically start settlement worker if enabled
    if (config.enableSettlementWorker) {
      import('./modules/trading/workers/settlementWorker.js')
        .then((m) => {
          const worker = new m.SettlementWorker();
          return worker.start();
        })
        .catch((err) => {
          logger.error('Failed to start settlement worker', { error: err.message });
        });
    }

    // Automatically start settlement recovery job if enabled
    if (config.enableSettlementRecovery) {
      import('./modules/trading/workers/settlementRecovery.job.js')
        .then((m) => {
          activeSettlementRecoveryJob = new m.SettlementRecoveryJob();
          return activeSettlementRecoveryJob.start();
        })
        .catch((err) => {
          logger.error('Failed to start settlement recovery job', { error: err.message });
        });
    }

    // Automatically start B2C dispatch worker if enabled
    if (config.enableB2cWorker) {
      import('./modules/payments/workers/b2cDispatchWorker.js')
        .then((m) => {
          activeB2cWorker = new m.B2CDispatchWorker();
          return activeB2cWorker.start();
        })
        .catch((err) => {
          logger.error('Failed to start B2C dispatch worker', { error: err.message });
        });
    }

    // Automatically start B2C reconciliation job if enabled
    if (config.enableB2cReconciliation) {
      import('./modules/payments/jobs/b2cReconciliation.job.js')
        .then((m) => {
          activeB2cReconciliationJob = new m.B2CReconciliationJob(
            pgPool,
            config.b2cReconciliationIntervalMs,
            () => config.enableB2cReconciliation
          );
          return activeB2cReconciliationJob.start();
        })
        .catch((err) => {
          logger.error('Failed to start B2C reconciliation job', { error: err.message });
        });
    }

    server.listen(PORT, () => {
      logger.info(`Server started on port ${PORT} in ${config.nodeEnv} mode`);
    });
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap().catch((err) => {
    logger.error('Boot failed', { error: err.message });
    process.exit(1);
  });
}

export { app, server };
export default app;
