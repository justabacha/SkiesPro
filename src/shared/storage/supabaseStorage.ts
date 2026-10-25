import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../../config/database.js';

export class SupabaseStorageClient {
  private readonly bucketName = 'avatars';
  private readonly kycBucketName = 'kyc-documents';

  /**
   * Uploads an avatar to Supabase Storage.
   * @param userId The ID of the user.
   * @param file The file buffer.
   * @param filename The original filename.
   * @returns The public URL of the uploaded avatar.
   */
  async uploadAvatar(userId: string, file: Buffer, filename: string): Promise<string> {
    const timestamp = Date.now();
    const filePath = `${userId}/${timestamp}_${filename}`;

    const { data, error } = await supabaseAdmin.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        contentType: this.getContentType(filename),
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload avatar: ${error.message}`);
    }

    return this.getPublicUrl(data.path);
  }

  async uploadKycDocument(file: Buffer, originalName: string, mimeType: string): Promise<string> {
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
      throw new Error('KYC documents must be JPEG or PNG images');
    }

    const timestamp = Date.now();
    const extension = mimeType === 'image/png' ? 'png' : 'jpg';
    const safeName =
      originalName
        .split(/[\\/]/)
        .pop()
        ?.replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(-100) || `document.${extension}`;
    const filePath = `${timestamp}-${randomUUID()}-${safeName}`;
    const { data, error } = await supabaseAdmin.storage
      .from(this.kycBucketName)
      .upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload KYC document: ${error.message}`);
    }

    return data.path;
  }

  async deleteKycDocument(filePath: string): Promise<void> {
    const { error } = await supabaseAdmin.storage.from(this.kycBucketName).remove([filePath]);
    if (error) {
      throw new Error(`Failed to remove KYC document: ${error.message}`);
    }
  }

  async createKycDocumentSignedUrl(filePath: string): Promise<string> {
    const { data, error } = await supabaseAdmin.storage
      .from(this.kycBucketName)
      .createSignedUrl(filePath, 60 * 60);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Failed to create KYC document signed URL: ${error?.message || 'No URL returned'}`
      );
    }
    return data.signedUrl;
  }

  /**
   * Deletes an object from the avatars bucket.
   * @param filePath The path of the file to delete (relative to bucket root).
   */
  async deleteAvatar(filePath: string): Promise<void> {
    // If the path is a full URL, extract the relative path
    const relativePath = this.extractRelativePath(filePath);

    const { error } = await supabaseAdmin.storage.from(this.bucketName).remove([relativePath]);

    if (error) {
      console.warn(`Failed to delete old avatar at ${relativePath}: ${error.message}`);
    }
  }

  /**
   * Generates a public URL for a given file path.
   * @param filePath The path within the bucket.
   */
  getPublicUrl(filePath: string): string {
    const { data } = supabaseAdmin.storage.from(this.bucketName).getPublicUrl(filePath);

    return data.publicUrl;
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'png') return 'image/png';
    return 'image/jpeg';
  }

  private extractRelativePath(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http')) {
      // Logic to extract part after /avatars/
      const parts = pathOrUrl.split(`/${this.bucketName}/`);
      if (parts.length > 1) {
        return parts[1];
      }
    }
    return pathOrUrl;
  }
}

export const storageClient = new SupabaseStorageClient();
