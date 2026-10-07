import express, { Application } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import { config } from './config/app.js';
import { corsMiddleware } from './config/cors.js';
import { correlationIdMiddleware } from './shared/middleware/correlationId.js';
import { requestLogger } from './shared/middleware/logger.js';
import routes from './infrastructure/routes.js';
import { logger } from './shared/middleware/logger.js';
import { attachWebSocketServer } from './infrastructure/websocket/wsServer.js';

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

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Server started on port ${PORT} in ${config.nodeEnv} mode`);
  });
}

export { app, server };
export default app;
