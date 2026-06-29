import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ALLOWED_IMAGE_TYPES } from '../../config/constants';

export const UPLOAD_PURPOSES = [
  'stay',
  'temple',
  'driver_kyc',
  'driver_profile',
] as const;

const ALLOWED_TYPES = Object.keys(ALLOWED_IMAGE_TYPES);

export class SignFileDto {
  @IsString()
  @IsIn(ALLOWED_TYPES, {
    message: `contentType must be one of: ${ALLOWED_TYPES.join(', ')}`,
  })
  contentType: string;
}

export class SignUploadDto {
  @IsIn(UPLOAD_PURPOSES as unknown as string[])
  purpose: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => SignFileDto)
  files: SignFileDto[];
}

export class SignReadDto {
  @IsString()
  objectKey: string;
}
