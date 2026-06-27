import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export type RideType = 'local' | 'poochari' | 'radhakund' | 'combined';
export type PaymentMethod = 'upi' | 'cash';

export class CreateRideDto {
  @IsIn(['local', 'poochari', 'radhakund', 'combined'])
  type: RideType;

  @IsOptional()
  @IsObject()
  pickup?: Record<string, any>;

  @IsOptional()
  @IsObject()
  drop?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  distance_km?: number;

  @IsIn(['upi', 'cash'])
  payment_method: PaymentMethod;

  @IsOptional()
  @IsString()
  scheduled_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelDto {
  @IsString()
  reason: string;
}

export class TipDto {
  @IsNumber()
  amount: number; // increment on top of current fare (e.g. 10 or 20)
}

export class VerifyPinDto {
  @IsString()
  pin: string;
}
