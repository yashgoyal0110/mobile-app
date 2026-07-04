import { IsNumber, IsOptional, IsString } from 'class-validator';

export class LandmarkDto {
  @IsString()
  name: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class LandmarkUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
