import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PrasadOrderItemDto {
  @IsString()
  item_id: string;

  @IsInt()
  @Min(1)
  qty: number;
}

export class CreatePrasadOrderDto {
  @IsString()
  temple_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrasadOrderItemDto)
  items: PrasadOrderItemDto[];

  @IsOptional()
  @IsString()
  contact_phone?: string;
}
