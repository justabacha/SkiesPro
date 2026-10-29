import supertest from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { TokenService } from '../../src/modules/auth/services/tokenService.js';
import { MfaService } from '../../src/modules/auth/services/mfaService.js';
import { MfaRepository } from '../../src/modules/auth/repositories/mfaRepository.js';

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;

function generateUniquePhone(): string {
  const random8 = Math.floor(10000000 + Math.random() * 90000000);
  return `07${random8}`;
}

describe('Settings Backend APIs Integration Tests (Slice 1)', () => {
  let testUserId: string;
  let testUserToken: string;
  let testUserJti: string;
  let testEmail: string;
  const initialPassword = 'Password123!';
  const newPassword = 'NewPassword123!';
  const tokenService = new TokenService();

  beforeAll(async () => {
    if (skipDatabaseTests) return;

    testEmail = `settings-test-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const phone = generateUniquePhone();

    const userRes = await pgPool.query(
      `INSERT INTO app_auth.users (email, password_hash, display_name, status, kyc_status, phone)
       VALUES ($1, $2, 'Settings Test User', 'active', 'verified', $3)
       RETURNING id`,
      [testEmail, passwordHash, phone]
    );
    testUserId = userRes.rows[0].id;

    const tokenGen = tokenService.generateAccessToken(testUserId, 'trader', []);
    testUserToken = tokenGen.token;
    testUserJti = tokenGen.jti;

    // Create current session in DB
    await pgPool.query(
      `INSERT INTO app_auth.sessions (user_id, token_hash, access_token_jti, expires_at, is_revoked)
       VALUES ($1, 'hash_current', $2, NOW() + INTERVAL '1 hour', FALSE)`,
      [testUserId, testUserJti]
    );

    // Create another active session with unique JTI
    const otherJti = `jti_other_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await pgPool.query(
      `INSERT INTO app_auth.sessions (user_id, token_hash, access_token_jti, expires_at, is_revoked)
       VALUES ($1, 'hash_other', $2, NOW() + INTERVAL '1 hour', FALSE)`,
      [testUserId, otherJti]
    );
  });

  afterAll(async () => {
    if (skipDatabaseTests) return;

    if (testUserId) {
      await pgPool.query('DELETE FROM app_auth.mfa_tokens WHERE user_id = $1', [testUserId]);
      await pgPool.query('DELETE FROM app_auth.password_history WHERE user_id = $1', [testUserId]);
      await pgPool.query('DELETE FROM app_auth.sessions WHERE user_id = $1', [testUserId]);
      await pgPool.query('DELETE FROM events.event_outbox WHERE aggregate_id = $1', [testUserId]);
      await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [testUserId]);
    }
  });

  describe('Password Management (PUT /api/v1/users/password)', () => {
    it('rejects password change with wrong current password', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .put('/api/v1/users/password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          current_password: 'WrongPassword123!',
          new_password: newPassword,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid current password');
    });

    it('rejects password change with new password failing policy', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .put('/api/v1/users/password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          current_password: initialPassword,
          new_password: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('successfully changes password and revokes other sessions', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .put('/api/v1/users/password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          current_password: initialPassword,
          new_password: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.message).toBe('Password updated successfully');

      // Verify other sessions were revoked
      const otherSession = await pgPool.query(
        "SELECT is_revoked FROM app_auth.sessions WHERE access_token_jti = 'jti_other_session_123'"
      );
      expect(otherSession.rows[0].is_revoked).toBe(true);

      // Verify current session remains active
      const currentSession = await pgPool.query(
        'SELECT is_revoked FROM app_auth.sessions WHERE access_token_jti = $1',
        [testUserJti]
      );
      expect(currentSession.rows[0].is_revoked).toBe(false);
    });
  });

  describe('MFA Management & Backup Codes', () => {
    beforeAll(async () => {
      if (skipDatabaseTests) return;

      const mfaService = new MfaService();
      const mfaRepo = new MfaRepository();
      const setup = await mfaService.generateMfaSetup(testEmail, testUserId);

      await mfaRepo.upsert(testUserId, setup.encryptedSecret, ['code1', 'code2']);
      await mfaRepo.verify(testUserId);
      await pgPool.query(
        "UPDATE app_auth.users SET mfa_enabled = TRUE, mfa_type = 'totp' WHERE id = $1",
        [testUserId]
      );
    });

    it('regenerates backup codes with valid password', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .post('/api/v1/auth/mfa/backup-codes/regenerate')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          password: newPassword,
        });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data.backup_codes)).toBe(true);
      expect(response.body.data.backup_codes.length).toBeGreaterThan(0);
    });

    it('disables MFA with valid password', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .post('/api/v1/auth/mfa/disable')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          password: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.message).toBe('MFA disabled successfully');

      const userRes = await pgPool.query(
        'SELECT mfa_enabled FROM app_auth.users WHERE id = $1',
        [testUserId]
      );
      expect(userRes.rows[0].mfa_enabled).toBe(false);
    });
  });

  describe('Email Change Double Opt-In', () => {
    let verificationToken: string;
    const newEmailTarget = `new-email-${Date.now()}@example.com`;

    it('initiates email change and creates outbox event', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .post('/api/v1/users/email-change/initiate')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          new_email: newEmailTarget,
          password: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.token).toBeDefined();
      verificationToken = response.body.data.token;

      // Verify Outbox Event created
      const outboxRes = await pgPool.query(
        "SELECT * FROM events.event_outbox WHERE aggregate_id = $1 AND event_type = 'EmailChangeInitiated'",
        [testUserId]
      );
      expect(outboxRes.rows.length).toBeGreaterThan(0);
    });

    it('verifies email change token and updates user email', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .post('/api/v1/users/email-change/verify')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          token: verificationToken,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(newEmailTarget);

      const userRes = await pgPool.query('SELECT email FROM app_auth.users WHERE id = $1', [
        testUserId,
      ]);
      expect(userRes.rows[0].email).toBe(newEmailTarget);
    });
  });

  describe('Session Management', () => {
    let revocableSessionId: string;

    beforeAll(async () => {
      if (skipDatabaseTests) return;

      const sessionRes = await pgPool.query(
        `INSERT INTO app_auth.sessions (user_id, token_hash, access_token_jti, expires_at, is_revoked, user_agent, ip_address)
         VALUES ($1, 'hash_revocable', 'jti_revocable_session_999', NOW() + INTERVAL '1 hour', FALSE, 'Mozilla/5.0 Test Agent', '127.0.0.1')
         RETURNING id`,
        [testUserId]
      );
      revocableSessionId = sessionRes.rows[0].id;
    });

    it('GET /api/v1/users/sessions lists active sessions', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .get('/api/v1/users/sessions')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('DELETE /api/v1/users/sessions/:id revokes specific session', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .delete(`/api/v1/users/sessions/${revocableSessionId}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.message).toBe('Session revoked successfully');

      const sessionRes = await pgPool.query(
        'SELECT is_revoked FROM app_auth.sessions WHERE id = $1',
        [revocableSessionId]
      );
      expect(sessionRes.rows[0].is_revoked).toBe(true);
    });
  });

  describe('Account Deactivation (POST /api/v1/users/deactivate)', () => {
    it('deactivates user account and revokes all sessions', async () => {
      if (skipDatabaseTests) return;

      const response = await supertest(app)
        .post('/api/v1/users/deactivate')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          password: newPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.message).toBe('Account deactivated successfully');

      const userRes = await pgPool.query(
        'SELECT status FROM app_auth.users WHERE id = $1',
        [testUserId]
      );
      expect(userRes.rows[0].status).toBe('closed');

      const sessionsRes = await pgPool.query(
        'SELECT is_revoked FROM app_auth.sessions WHERE user_id = $1 AND is_revoked = FALSE',
        [testUserId]
      );
      expect(sessionsRes.rows.length).toBe(0);
    });
  });
});
