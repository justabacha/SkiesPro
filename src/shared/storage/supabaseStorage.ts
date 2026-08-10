import { supabaseAdmin } from '../../config/database';

export class SupabaseStorageClient {
  private readonly bucketName = 'avatars';

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
