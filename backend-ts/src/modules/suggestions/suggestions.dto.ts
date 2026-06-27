import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class SuggestFareDto {
  @IsString()
  ride_type: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class VoteDto {
  @IsIn(['up', 'down'])
  vote: 'up' | 'down';
}
