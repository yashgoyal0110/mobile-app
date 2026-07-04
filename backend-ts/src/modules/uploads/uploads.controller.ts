import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { StorageService, UploadPurpose } from './storage.service';
import { SignReadDto, SignUploadDto } from './uploads.dto';

// Who may request upload URLs for each purpose.
const PURPOSE_ROLES: Record<UploadPurpose, string[]> = {
  stay: ['admin'],
  temple: ['admin'],
  driver_kyc: ['driver', 'admin'],
  driver_profile: ['driver', 'admin'],
};

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  /** Lets the client decide whether to use the upload flow. */
  @Get('status')
  status() {
    return { enabled: this.storage.enabled };
  }

  /** Issue signed PUT URLs so the client can upload images straight to GCS. */
  @Post('sign')
  @UseGuards(AuthGuard)
  async sign(@Body() body: SignUploadDto, @CurrentUser() user: any) {
    const purpose = body.purpose as UploadPurpose;
    const allowed = PURPOSE_ROLES[purpose] || [];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException(`Not allowed to upload "${purpose}" images`);
    }
    const uploads = await Promise.all(
      body.files.map((f) => this.storage.signUpload(purpose, f.contentType)),
    );
    return { uploads };
  }

  /** Short-lived view URL for a private object (admin reviewing KYC docs). */
  @Post('sign-read')
  @UseGuards(AuthGuard)
  async signRead(@Body() body: SignReadDto, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
    const url = await this.storage.signRead(body.objectKey);
    return { url };
  }
}
