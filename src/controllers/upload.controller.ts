import { Controller, Post, Body, UseInterceptors, UploadedFile, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../services/upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('initiate')
  async initiateUpload(
    @Body() body: { filename: string; mimetype: string },
  ) {
    const { filename, mimetype } = body;
    const uploadId = await this.uploadService.initiateUpload(filename, mimetype);
    return { uploadId };
  }

  @Post('part/:uploadId/:partNumber')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPart(
    @Param('uploadId') uploadId: string,
    @Param('partNumber') partNumber: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('filename') filename: string,
  ) {
    const part = await this.uploadService.uploadPart(file, uploadId, filename, partNumber);
    return { part };
  }

  @Post('complete/:uploadId')
  async completeUpload(
    @Param('uploadId') uploadId: string,
    @Body() body: { filename: string; parts: Array<{ ETag: string; PartNumber: number }> },
  ) {
    const { filename, parts } = body;
    const location = await this.uploadService.completeUpload(uploadId, filename, parts);
    return { location };
  }
} 