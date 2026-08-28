import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import { config } from './config/app';
import { correlationIdMiddleware } from './shared/middleware/correlationId';
import { requestLogger } from './shared/middleware/logger';
import routes from './infrastructure/routes';
import { logger } from './shared/middleware/logger';
import { attachWebSocketServer } from './infrastructure/websocket/wsServer';

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

// Automatically start price feed if enabled (for single-service deployments like Render Free Tier)
if (config.enablePriceFeed) {
  import('./modules/pricing/bootstrap')
    .then((m) => m.bootstrapPriceFeed())
    .catch((err) => {
      logger.error('Failed to auto-start price feed', { error: err.message });
    });
}

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Server started on port ${PORT} in ${config.nodeEnv} mode`);
  });
}

export { app, server };
export default app;
