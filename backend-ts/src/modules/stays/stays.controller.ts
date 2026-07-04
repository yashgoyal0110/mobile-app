import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { Roles } from '../../common/roles.decorator';
import { StaysService } from './stays.service';
import { StayDto, StayUpdateDto } from './stays.dto';

function toNum(v?: string): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function toBool(v?: string): boolean | undefined {
  if (v == null) return undefined;
  return v === 'true' || v === '1';
}

/** Public (pilgrim) stay discovery — read-only, verified listings only. */
@Controller('stays')
export class StaysController {
  constructor(private readonly stays: StaysService) {}

  @Get()
  list(
    @Query('type') type?: string,
    @Query('amenity') amenity?: string,
    @Query('q') q?: string,
    @Query('max_price') maxPrice?: string,
    @Query('available_only') availableOnly?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.stays.listStays({
      type,
      amenity,
      q,
      max_price: toNum(maxPrice),
      available_only: toBool(availableOnly) ?? false,
      lat: toNum(lat),
      lng: toNum(lng),
    });
  }

  @Get(':stayId')
  get(
    @Param('stayId') stayId: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.stays.getStay(stayId, toNum(lat), toNum(lng));
  }
}

/** Admin stay management. Mirrors Python `stays.admin_router` (prefix /admin/stays). */
@Controller('admin/stays')
@UseGuards(AuthGuard)
@Roles('admin')
export class StaysAdminController {
  constructor(private readonly stays: StaysService) {}

  @Get()
  list(@Query('verified') verified?: string) {
    return this.stays.adminListStays(toBool(verified));
  }

  @Post()
  create(@Body() body: StayDto) {
    return this.stays.adminCreateStay(body);
  }

  @Patch(':stayId')
  update(@Param('stayId') stayId: string, @Body() body: StayUpdateDto) {
    return this.stays.adminUpdateStay(stayId, body);
  }

  @Delete(':stayId')
  remove(@Param('stayId') stayId: string) {
    return this.stays.adminDeleteStay(stayId);
  }
}
