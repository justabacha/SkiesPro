import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import { config } from './config/app.js';
import { correlationIdMiddleware } from './shared/middleware/correlationId.js';
import { requestLogger } from './shared/middleware/logger.js';
import routes from './infrastructure/routes.js';
import { logger } from './shared/middleware/logger.js';
import { attachWebSocketServer } from './infrastructure/websocket/wsServer.js';

const app: Application = express();

// Trust Render Proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = Array.isArray(config.corsOrigin)
        ? config.corsOrigin
        : [config.corsOrigin];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom middleware
app.use(correlationIdMiddleware);
app.use(requestLogger);

// Routes
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', {
    correlationId: (req as any).correlationId,
    error: err.message,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
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
