import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/app';
import { correlationIdMiddleware } from './shared/middleware/correlationId';
import { requestLogger } from './shared/middleware/logger';
import routes from './infrastructure/routes';
import { logger } from './shared/middleware/logger';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.corsOrigin,
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
    correlationId: req.correlationId,
    error: err.message,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

const PORT = config.port;

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT} in ${config.nodeEnv} mode`);
});

export default app;
