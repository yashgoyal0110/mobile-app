import { Global, Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { StorageService } from './storage.service';

/**
 * Global so any feature service can inject StorageService to verify images
 * before persisting a resource.
 */
@Global()
@Module({
  controllers: [UploadsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class UploadsModule {}
