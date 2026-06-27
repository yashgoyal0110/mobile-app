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
import { TemplesService } from './temples.service';
import { TempleDto, TempleUpdateDto } from './temples.dto';

function toNum(v?: string): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

function toBool(v?: string): boolean | undefined {
  if (v == null) return undefined;
  return v === 'true' || v === '1';
}

/** Public (pilgrim) temple info — read-only, verified temples only. */
@Controller('temples')
export class TemplesController {
  constructor(private readonly temples: TemplesService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.temples.listTemples({ q, lat: toNum(lat), lng: toNum(lng) });
  }

  @Get(':templeId')
  get(
    @Param('templeId') templeId: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.temples.getTemple(templeId, toNum(lat), toNum(lng));
  }
}

/** Admin temple management. Mirrors Python `temples.admin_router` (/admin/temples). */
@Controller('admin/temples')
@UseGuards(AuthGuard)
@Roles('admin')
export class TemplesAdminController {
  constructor(private readonly temples: TemplesService) {}

  @Get()
  list(@Query('verified') verified?: string) {
    return this.temples.adminListTemples(toBool(verified));
  }

  @Post()
  create(@Body() body: TempleDto) {
    return this.temples.adminCreateTemple(body);
  }

  @Patch(':templeId')
  update(@Param('templeId') templeId: string, @Body() body: TempleUpdateDto) {
    return this.temples.adminUpdateTemple(templeId, body);
  }

  @Delete(':templeId')
  remove(@Param('templeId') templeId: string) {
    return this.temples.adminDeleteTemple(templeId);
  }
}
