import {
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export type RoleType = 'passenger' | 'driver' | 'admin';

export class SendOtpDto {
  @IsString()
  phone: string;

  @IsIn(['passenger', 'driver', 'admin'])
  role: RoleType;
}

export class VerifyOtpDto {
  @IsString()
  phone: string;

  @IsIn(['passenger', 'driver', 'admin'])
  role: RoleType;

  @IsString()
  otp: string;

  @IsOptional()
  @IsString()
  name?: string; // provided when signing up a new user
}
