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

```
skiespro/
├── src/
│   ├── modules/           # Business logic modules
│   ├── shared/            # Shared utilities and middleware
│   │   ├── middleware/    # Express middleware (logging, correlation ID)
│   │   ├── utils/         # Utility functions
│   │   ├── types/         # TypeScript type definitions
│   │   └── constants/     # Application constants
│   ├── config/            # Configuration files
│   └── infrastructure/    # Infrastructure setup (routes, health checks)
├── tests/                 # Test files
├── docker/                # Docker configuration
├── .github/               # GitHub Actions workflows
└── docs/                  # Documentation
```

## Prerequisites

- Node.js 20.x or higher
- npm
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/[YOUR_USERNAME]/skiespro.git
cd skiespro
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration values (see `.env.example` for reference)

## Development

### Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Run tests:
```bash
npm test
```

### Run tests with coverage:
```bash
npm run test:coverage
```

### Run linter:
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
    "status": "ok",
    "timestamp": "2026-07-29T00:00:00.000Z"
  }
  ```

### Readiness Check
- **GET** `/ready` - Returns service readiness status
  ```json
  {
    "status": "ready",
    "checks": {}
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
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - Allowed CORS origin
- `LOG_LEVEL` - Logging level (info/warn/error)

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
