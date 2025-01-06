import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';
import { S3Service } from './services/s3.service';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
  ],
  controllers: [AppController,UploadController],
  providers: [AppService,UploadService, S3Service],
})
export class AppModule {}
