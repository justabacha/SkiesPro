import request from 'supertest';
import app from '../src/index';
import { pgPool } from '../src/config/database';

describe('Health Check Endpoints', () => {
  describe('GET /health', () => {
    it('should return 200 with system health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptime_seconds');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('GET /ready', () => {
    it('should return 200 with readiness status', async () => {
      const response = await request(app).get('/ready');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body).toHaveProperty('checks');
      expect(typeof response.body.checks).toBe('object');
      expect(response.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('Correlation ID Middleware', () => {
    it('should generate correlation ID if not provided', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(typeof response.headers['x-correlation-id']).toBe('string');
    });

    it('should use provided correlation ID from header', async () => {
      const customCorrelationId = 'test-correlation-123';
      const response = await request(app)
        .get('/health')
        .set('x-correlation-id', customCorrelationId);
      
      expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
      expect(response.body).toHaveProperty('path', '/non-existent');
    });
  });

  afterAll(async () => {
    await pgPool.end();
  });
});
