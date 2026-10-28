import express from 'express';
import supertest from 'supertest';
import { verifyIntasendChallenge } from '../../src/modules/payments/middleware/verifyIntasendChallenge.js';

describe('IntaSend Challenge Middleware Tests', () => {
  const originalEnv = process.env;
  let testApp: express.Application;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.INTASEND_WEBHOOK_CHALLENGE = 'expected-challenge-123';

    testApp = express();
    testApp.use(express.json());
    testApp.post('/test-webhook', verifyIntasendChallenge, (_req, res) => {
      res.status(200).json({ success: true });
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('1. Correct challenge -> next() called, returns 200 success', async () => {
    const res = await supertest(testApp)
      .post('/test-webhook')
      .send({ challenge: 'expected-challenge-123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('2. Wrong challenge -> HTTP 401 { error: "Invalid challenge" }', async () => {
    const res = await supertest(testApp)
      .post('/test-webhook')
      .send({ challenge: 'wrong-challenge-123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid challenge' });
  });

  it('3. Missing challenge field -> HTTP 401', async () => {
    const res = await supertest(testApp)
      .post('/test-webhook')
      .send({ data: 'some_payload' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid challenge' });
  });

  it('4. Empty string challenge -> HTTP 401', async () => {
    const res = await supertest(testApp)
      .post('/test-webhook')
      .send({ challenge: '' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid challenge' });
  });

  it('5. INTASEND_WEBHOOK_CHALLENGE unset at middleware invocation -> HTTP 500', async () => {
    delete process.env.INTASEND_WEBHOOK_CHALLENGE;

    const res = await supertest(testApp)
      .post('/test-webhook')
      .send({ challenge: 'any-challenge' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Server configuration error: INTASEND_WEBHOOK_CHALLENGE is not set',
    });
  });

  it('6. Length-mismatch challenge -> HTTP 401 without timingSafeEqual buffer error', async () => {
    // Challenge length 22, input length 5
    const res = await supertest(testApp)
      .post('/test-webhook')
      .send({ challenge: 'short' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid challenge' });
  });
});
