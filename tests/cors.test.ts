import express from 'express';
import request from 'supertest';
import { config } from '../src/config/app.js';
import { corsMiddleware } from '../src/config/cors.js';

describe('CORS middleware', () => {
  const app = express();
  app.use(corsMiddleware);
  app.options('*', corsMiddleware);
  app.get('/health', (_req, res) => res.sendStatus(200));

  it('allows configured origins and required admin preflight headers', async () => {
    const response = await request(app)
      .options('/health')
      .set('Origin', config.corsOrigin[0])
      .set('Access-Control-Request-Method', 'POST')
      .set(
        'Access-Control-Request-Headers',
        'authorization, content-type, idempotency-key, x-admin-mfa-token, x-request-id'
      )
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(config.corsOrigin[0]);
    expect(response.headers['access-control-allow-methods']).toContain('OPTIONS');
    expect(response.headers['access-control-allow-headers']).toContain('X-Admin-MFA-Token');
  });

  it('denies unconfigured origins without returning an application error', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'https://not-allowed.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
