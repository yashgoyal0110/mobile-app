import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class KycDto {
  @IsString()
  name: string;

  @IsString()
  aadhar_number: string;

  @IsString()
  aadhar_photo: string;

  @IsString()
  vehicle_no: string;

  @IsOptional()
  @IsString()
  vehicle_type: string = 'e-rickshaw';

  @IsString()
  rc_photo: string;

  @IsString()
  profile_photo: string;

  @IsString()
  upi_id: string;
}

export class OnlineDto {
  @IsBoolean()
  online: boolean;
}

export class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsOptional()
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsNumber()
  speed?: number;
}

export class WithdrawDto {
  @IsNumber()
  amount: number;
}
