import supertest from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../src/index.js';
import { pgPool } from '../../src/config/database.js';
import { TokenService } from '../../src/modules/auth/services/tokenService.js';
import { storageClient } from '../../src/shared/storage/supabaseStorage.js';

jest.mock('../../src/shared/storage/supabaseStorage.js');

const skipDatabaseTests = process.env.SKIP_DB_TESTS === 'true' || !process.env.DATABASE_URL;
const jpegImage = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

describe('KYC document uploads', () => {
  let userId: string;
  let userToken: string;
  let testEmail: string;

  beforeAll(async () => {
    userToken = new TokenService().generateAccessToken('kyc-upload-test-user', 'trader', []).token;
    if (skipDatabaseTests) return;

    testEmail = `kyc-upload-${Date.now()}@example.com`;
    const passwordHash = await bcrypt.hash('KycTestPassword123!', 10);
    const userResult = await pgPool.query(
      `INSERT INTO app_auth.users
         (email, password_hash, display_name, status, kyc_status)
       VALUES ($1, $2, 'KYC Upload Test', 'active', 'unverified')
       RETURNING id`,
      [testEmail, passwordHash]
    );
    userId = userResult.rows[0].id;
    userToken = new TokenService().generateAccessToken(userId, 'trader', []).token;
  });

  beforeEach(() => {
    (storageClient.uploadKycDocument as jest.Mock).mockReset();
    (storageClient.deleteKycDocument as jest.Mock).mockReset();
    (storageClient.uploadKycDocument as jest.Mock).mockResolvedValue(
      '1712345678901-kyc-test-id.jpg'
    );
    (storageClient.deleteKycDocument as jest.Mock).mockResolvedValue(undefined);
  });

  afterAll(async () => {
    if (skipDatabaseTests || !userId) return;
    await pgPool.query('DELETE FROM compliance.kyc_documents WHERE user_id = $1', [userId]);
    await pgPool.query('DELETE FROM app_auth.sessions WHERE user_id = $1', [userId]);
    await pgPool.query('DELETE FROM app_auth.users WHERE id = $1', [userId]);
  });

  const uploadDocument = () =>
    supertest(app)
      .post('/api/v1/users/kyc/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .field('document_type', 'national_id')
      .field('document_number', 'ID-TEST-92751')
      .attach('image', jpegImage, { filename: 'national-id.jpg', contentType: 'image/jpeg' });

  it('uploads the document and stores its path, hash, number, and pending status', async () => {
    if (skipDatabaseTests) return;

    const response = await uploadDocument();
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        message: 'Document uploaded successfully',
        kyc_status: 'pending',
      },
    });
    expect(storageClient.uploadKycDocument).toHaveBeenCalledWith(
      jpegImage,
      'national-id.jpg',
      'image/jpeg'
    );

    const documentResult = await pgPool.query(
      `SELECT document_type, document_number, file_storage_path, file_hash, status
       FROM compliance.kyc_documents WHERE user_id = $1`,
      [userId]
    );
    expect(documentResult.rows).toHaveLength(1);
    expect(documentResult.rows[0]).toMatchObject({
      document_type: 'national_id',
      document_number: 'ID-TEST-92751',
      file_storage_path: '1712345678901-kyc-test-id.jpg',
      status: 'pending',
    });
    expect(documentResult.rows[0].file_hash).toMatch(/^[a-f0-9]{64}$/);

    const userResult = await pgPool.query('SELECT kyc_status FROM app_auth.users WHERE id = $1', [
      userId,
    ]);
    expect(userResult.rows[0].kyc_status).toBe('pending');
  });

  it('rejects files larger than 5 MB', async () => {
    const response = await supertest(app)
      .post('/api/v1/users/kyc/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .field('document_type', 'national_id')
      .field('document_number', 'ID-TEST-92751')
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1, 1), {
        filename: 'large.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(413);
    expect(response.body.error).toContain('File too large');
    expect(storageClient.uploadKycDocument).not.toHaveBeenCalled();
  });

  it('rejects non-image file types', async () => {
    const response = await supertest(app)
      .post('/api/v1/users/kyc/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .field('document_type', 'national_id')
      .field('document_number', 'ID-TEST-92751')
      .attach('image', Buffer.from('not an image'), {
        filename: 'document.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Only JPEG and PNG');
    expect(storageClient.uploadKycDocument).not.toHaveBeenCalled();
  });

  it('rejects image MIME types that do not match image content', async () => {
    const response = await supertest(app)
      .post('/api/v1/users/kyc/documents')
      .set('Authorization', `Bearer ${userToken}`)
      .field('document_type', 'national_id')
      .field('document_number', 'ID-TEST-92751')
      .attach('image', Buffer.from('not really a jpeg'), {
        filename: 'document.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid image content');
    expect(storageClient.uploadKycDocument).not.toHaveBeenCalled();
  });
});
