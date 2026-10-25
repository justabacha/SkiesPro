import { PoolClient } from 'pg';
import { BaseRepository } from '../../../shared/repositories/baseRepository.js';

export class KycRepository extends BaseRepository {
  constructor(client?: PoolClient) {
    super(client);
  }

  async insertDocument(input: {
    userId: string;
    documentType: string;
    documentNumber: string;
    fileStoragePath: string;
    fileHash: string;
  }): Promise<void> {
    await this.query(
      `INSERT INTO compliance.kyc_documents
         (user_id, document_type, document_number, file_storage_path, file_hash, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [
        input.userId,
        input.documentType,
        input.documentNumber,
        input.fileStoragePath,
        input.fileHash,
      ]
    );
  }

  async setUserKycPending(userId: string): Promise<void> {
    const result = await this.query(
      `UPDATE app_auth.users
       SET kyc_status = 'pending', updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (result.rowCount !== 1) {
      throw new Error('User not found');
    }
  }
}
