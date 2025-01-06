import { Injectable, Logger } from '@nestjs/common';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3 } from 'aws-sdk';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly logger = new Logger(S3Service.name);
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB minimum chunk size for S3
  private s3: S3;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.s3 = new S3();
  }

  async initiateMultipartUpload(filename: string, contentType: string): Promise<string> {
    const command = new CreateMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
      ContentType: contentType,
    });

    try {
      const response = await this.s3Client.send(command);
      return response.UploadId;
    } catch (error) {
      this.logger.error(`Failed to initiate multipart upload: ${error.message}`);
      throw error;
    }
  }

  async uploadPart(
    uploadId: string,
    key: string,
    filePath: string,
    partNumber: number,
  ): Promise<{ ETag: string; PartNumber: number }> {
    const fileStream = fs.createReadStream(filePath);
    
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: fileStream,
    };

    const result = await this.s3.uploadPart(uploadParams).promise();
    
    return {
      ETag: result.ETag,
      PartNumber: partNumber,
    };
  }

  async completeMultipartUpload(uploadId: string, filename: string, parts: { ETag: string; PartNumber: number }[]): Promise<string> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    try {
      await this.s3Client.send(command);
      
      // Generate presigned URL
      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: filename,
      });
      
      // URL expires in 1 hour (3600 seconds)
      const presignedUrl = await getSignedUrl(this.s3Client, getObjectCommand, { expiresIn: 3600 });
      return presignedUrl;
      
    } catch (error) {
      this.logger.error(`Failed to complete multipart upload: ${error.message}`);
      throw error;
    }
  }

  async abortMultipartUpload(uploadId: string, filename: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
      UploadId: uploadId,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Failed to abort multipart upload: ${error.message}`);
      throw error;
    }
  }
} 