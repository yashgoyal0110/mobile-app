import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class RateRideDto {
  @IsInt()
  stars: number; // 1..5

  @IsOptional()
  @IsString()
  comment?: string;
}

const COMPLAINT_CATEGORIES = [
  'rash_driving',
  'rude_behaviour',
  'overcharge',
  'vehicle_unsafe',
  'no_show',
  'wrong_route',
  'payment_issue',
  'lost_item',
  'other',
] as const;

export class ComplaintDto {
  @IsIn(COMPLAINT_CATEGORIES as unknown as string[])
  category: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsIn(['driver', 'passenger'])
  against?: 'driver' | 'passenger';
}

export class ResolveComplaintDto {
  @IsString()
  resolution: string;

  @IsOptional()
  @IsIn(['resolved', 'rejected'])
  status: 'resolved' | 'rejected' = 'resolved';
}
