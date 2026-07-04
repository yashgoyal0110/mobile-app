import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export const CROWD_LEVELS = ['low', 'moderate', 'high', 'very_high'] as const;

export class TempleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  deity?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsArray()
  darshan_slots: any[] = [];

  @IsOptional()
  @IsArray()
  aarti_timings: any[] = [];

  @IsOptional()
  @IsIn(CROWD_LEVELS as unknown as string[])
  crowd_level?: string;

  @IsOptional()
  @IsString()
  entry_info?: string;

  @IsOptional()
  @IsString()
  special_note?: string;

  @IsOptional()
  @IsArray()
  photos: string[] = [];

  @IsOptional()
  @IsArray()
  prasad_items: any[] = [];

  @IsOptional()
  @IsBoolean()
  verified: boolean = false;

  @IsOptional()
  @IsBoolean()
  featured: boolean = false;
}

export class TempleUpdateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() deity?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() contact_phone?: string;
  @IsOptional() @IsArray() darshan_slots?: any[];
  @IsOptional() @IsArray() aarti_timings?: any[];
  @IsOptional() @IsIn(CROWD_LEVELS as unknown as string[]) crowd_level?: string;
  @IsOptional() @IsString() entry_info?: string;
  @IsOptional() @IsString() special_note?: string;
  @IsOptional() @IsArray() photos?: string[];
  @IsOptional() @IsArray() prasad_items?: any[];
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
}
