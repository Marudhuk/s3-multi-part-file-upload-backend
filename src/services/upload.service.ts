import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from './s3.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly MAX_RETRIES = 3;
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  constructor(private readonly s3Service: S3Service) {}

  async initiateUpload(filename: string, mimetype: string): Promise<string> {
    return await this.s3Service.initiateMultipartUpload(filename, mimetype);
  }

  async uploadPart(
    file: Express.Multer.File,
    uploadId: string,
    filename: string,
    partNumber: number,
  ): Promise<{ ETag: string; PartNumber: number }> {
    const tempFilePath = await this.saveTempFile(file);
    
    try {
      const part = await this.s3Service.uploadPart(
        uploadId,
        filename,
        tempFilePath,
        partNumber,
      );
      await this.cleanupTempFile(tempFilePath);
      return part;
    } catch (error) {
      await this.cleanupTempFile(tempFilePath);
      throw error;
    }
  }

  async completeUpload(
    uploadId: string,
    filename: string,
    parts: Array<{ ETag: string; PartNumber: number }>,
  ): Promise<string> {
    try {
      return await this.s3Service.completeMultipartUpload(uploadId, filename, parts);
    } catch (error) {
      await this.s3Service.abortMultipartUpload(uploadId, filename);
      throw error;
    }
  }

  private async saveTempFile(file: Express.Multer.File): Promise<string> {
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `${uuidv4()}-${file.originalname}`);
    await fs.writeFile(tempFilePath, file.buffer);
    return tempFilePath;
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error(`Failed to cleanup temp file: ${error.message}`);
    }
  }
} 