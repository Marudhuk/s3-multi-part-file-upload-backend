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

  async processUpload(file: Express.Multer.File): Promise<string> {
    const tempFilePath = await this.saveTempFile(file);
    const uploadId = await this.s3Service.initiateMultipartUpload(
      file.originalname,
      file.mimetype,
    );

    try {
      const parts = await this.uploadParts(tempFilePath, uploadId, file.originalname);
      const location = await this.s3Service.completeMultipartUpload(
        uploadId,
        file.originalname,
        parts,
      );
      await this.cleanupTempFile(tempFilePath);
      return location;
    } catch (error) {
      await this.s3Service.abortMultipartUpload(uploadId, file.originalname);
      await this.cleanupTempFile(tempFilePath);
      throw error;
    }
  }

  private async saveTempFile(file: Express.Multer.File): Promise<string> {
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `${uuidv4()}-${file.originalname}`);
    await fs.writeFile(tempFilePath, file.buffer);
    return tempFilePath;
  }

  private async uploadParts(
    filePath: string,
    uploadId: string,
    filename: string,
  ): Promise<{ ETag: string; PartNumber: number }[]> {
    const fileHandle = await fs.open(filePath, 'r');
    const fileSize = (await fileHandle.stat()).size;
    const parts: { ETag: string; PartNumber: number }[] = [];
    let partNumber = 1;

    for (let position = 0; position < fileSize; position += this.CHUNK_SIZE) {
      const chunk = Buffer.alloc(Math.min(this.CHUNK_SIZE, fileSize - position));
      await fileHandle.read(chunk, 0, chunk.length, position);

      const etag = await this.uploadPartWithRetry(
        uploadId,
        partNumber,
        filename,
        chunk,
      );

      parts.push({ ETag: etag, PartNumber: partNumber });
      partNumber++;
    }

    await fileHandle.close();
    return parts;
  }

  private async uploadPartWithRetry(
    uploadId: string,
    partNumber: number,
    filename: string,
    chunk: Buffer,
    retryCount = 0,
  ): Promise<string> {
    try {
      return await this.s3Service.uploadPart(uploadId, partNumber, filename, chunk);
    } catch (error) {
      if (retryCount < this.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
        return this.uploadPartWithRetry(
          uploadId,
          partNumber,
          filename,
          chunk,
          retryCount + 1,
        );
      }
      throw error;
    }
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error(`Failed to cleanup temp file: ${error.message}`);
    }
  }
} 