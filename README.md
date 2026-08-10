# SkiesPro Binary Trading Platform

A modern binary trading platform built with TypeScript, Express.js, and following industry best practices.

## Tech Stack

- **Runtime**: Node.js 20.x LTS
- **Language**: TypeScript
- **Framework**: Express.js
- **Package Manager**: npm
- **Testing**: Jest + Supertest
- **Containerization**: Docker
- **CI/CD**: GitHub Actions

## Project Structure

This project is organized as a monorepo containing both backend and frontend applications.

```
skiespro/
├── backend/               # Backend application
│   ├── src/
│   │   ├── modules/       # Business logic modules
│   │   ├── shared/        # Backend shared utilities
│   │   ├── config/        # Configuration files
│   │   └── index.ts       # Entry point
│   ├── migrations/        # Database migrations
│   ├── tests/             # Backend tests
│   ├── package.json
│   └── tsconfig.json
├── frontend/              # Frontend application (Vite + React)
│   ├── src/
│   │   ├── modules/       # Frontend feature modules
│   │   ├── shared/        # Frontend shared components, hooks, etc.
│   │   ├── pages/         # Page components
│   │   └── main.tsx       # Entry point
│   ├── package.json
│   └── tsconfig.json
├── docs/                  # Project documentation
├── work-packages/         # Implementation work packages
└── docker/                # Docker configuration
```

## Prerequisites

- Node.js 22.x or higher
- npm
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/justabacha/skiespro.git
cd skiespro
```

2. Install dependencies for both backend and frontend:
```bash
# Install root/backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

3. Create environment file in the root/backend:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration values.

## Development

### Run the backend server:
```bash
npm run dev
```
The server will start on `http://localhost:3000`

### Run the frontend application:
```bash
cd frontend
npm run dev
```
The frontend will start on `http://localhost:5173` (proxies `/api` to port 3000)

### Run backend tests:
```bash
npm test
```

### Run backend linter:
```bash
npm run lint
```

### Fix linting issues:
```bash
npm run lint:fix
```

### Format code:
```bash
npm run format
```

### Type check:
```bash
npm run typecheck
```

## Production

### Build the project:
```bash
npm run build
```

### Start production server:
```bash
npm start
```

## Docker

### Build Docker image:
```bash
docker build -f docker/Dockerfile -t skiespro:latest .
```

### Run with docker-compose:
```bash
cd docker
docker-compose up -d
```

### Verify container is running:
```bash
docker ps
```

## API Endpoints

### Health Check
- **GET** `/health` - Returns service health status
  ```json
  {
    "status": "healthy",
    "version": "1.0.0",
    "uptime_seconds": 123,
    "dependencies": {
      "postgresql": { "status": "healthy", "latency_ms": 15 },
      "redis_sessions": { "status": "healthy", "latency_ms": 5 },
      "redis_pricing": { "status": "healthy", "latency_ms": 5 },
      "message_broker": { "status": "healthy", "latency_ms": 10 }
    }
  }
  ```

### Readiness Check
- **GET** `/ready` - Returns service readiness status (200 OK or 503 Service Unavailable)
  ```json
  {
    "status": "ready",
    "checks": {
      "postgresql": { "status": "healthy", "latency_ms": 15 },
      "redis_sessions": { "status": "healthy", "latency_ms": 5 },
      "redis_pricing": { "status": "healthy", "latency_ms": 5 },
      "message_broker": { "status": "healthy", "latency_ms": 10 }
    }
  }
  ```

## Logging

The application uses structured JSON logging with correlation IDs for request tracing. All logs include:
- Timestamp
- Log level (info, warn, error)
- Correlation ID (for request tracing)
- Contextual information

## CI/CD

The project uses GitHub Actions for continuous integration and deployment. The pipeline includes:
- Linting (ESLint)
- Type checking (TypeScript)
- Testing (Jest)
- Code formatting checks (Prettier)
- Docker build validation

## Environment Variables

See `.env.example` for all available environment variables. Key variables include:

### Server & App
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)
- `CORS_ORIGIN` - Allowed CORS origin
- `LOG_LEVEL` - Logging level (info/warn/error)

### Database (Supabase/PostgreSQL)
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://postgres:password@db.project-ref.supabase.co:5432/postgres`)
- `SUPABASE_URL` - Supabase project URL (e.g., `https://project-ref.supabase.co`)
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Redis & Message Queue
- `REDIS_URL` - Redis connection URL
- `MESSAGE_BROKER_URL` - Message broker connection URL (e.g., RabbitMQ)

## Troubleshooting

### Database Connection Issues (`ENOTFOUND`)
If you see `getaddrinfo ENOTFOUND` for your database host in tests or during startup:
1. **Check `.env` file**: Ensure `DATABASE_URL` is correctly set and has no typos.
2. **Supabase Project Status**: Verify that your Supabase project is active and not paused.
3. **Network/Firewall**: Ensure your environment has access to the internet and can reach `*.supabase.co`.
4. **DNS Cache**: Sometimes flushing your DNS cache or using a different DNS provider (like 8.8.8.8) helps.
5. **VPN**: If you are using a VPN, try disconnecting or ensuring it allows traffic to your database host.

### Tests Hanging
If tests fail to exit gracefully:
1. Ensure all database pools and network connections are closed in `afterAll` blocks.
2. Check for unref'd timers or open handles using `npm test -- --detectOpenHandles`.

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

UNLICENSED

## Support

- **Project Owner**: AMOS FX
- **Email**: austines.bot@gmail.com
- **Tech Lead**: RYAN RAY (ryan141rays@gmail.com)
- **Support**: skiespro.ltd@gmail.com
