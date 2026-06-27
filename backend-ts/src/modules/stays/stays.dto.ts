import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export const STAY_TYPES = [
  'dharamshala',
  'guesthouse',
  'ashram',
  'lodge',
  'hotel',
] as const;

// Amenity keys understood by the frontend (rendered as icons/labels).
export const AMENITY_KEYS = new Set([
  'parking',
  'food',
  'ac',
  'hot_water',
  'wifi',
  'lift',
  'family_rooms',
  'elderly_friendly',
  'wheelchair',
  'locker',
  'power_backup',
]);

export class StayDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(STAY_TYPES as unknown as string[])
  type: string = 'dharamshala';

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

  @IsString()
  contact_phone: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsNumber()
  price_min?: number;

  @IsOptional()
  @IsNumber()
  price_max?: number;

  @IsOptional()
  @IsBoolean()
  donation_based: boolean = false;

  @IsOptional()
  @IsArray()
  room_types: string[] = [];

  @IsOptional()
  @IsNumber()
  capacity?: number;

  @IsOptional()
  @IsArray()
  amenities: string[] = [];

  @IsOptional()
  @IsArray()
  photos: string[] = [];

  @IsOptional()
  @IsBoolean()
  verified: boolean = false;

  @IsOptional()
  @IsBoolean()
  available: boolean = true;

  @IsOptional()
  @IsBoolean()
  featured: boolean = false;
}

export class StayUpdateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(STAY_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() contact_phone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsNumber() price_min?: number;
  @IsOptional() @IsNumber() price_max?: number;
  @IsOptional() @IsBoolean() donation_based?: boolean;
  @IsOptional() @IsArray() room_types?: string[];
  @IsOptional() @IsNumber() capacity?: number;
  @IsOptional() @IsArray() amenities?: string[];
  @IsOptional() @IsArray() photos?: string[];
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
}
