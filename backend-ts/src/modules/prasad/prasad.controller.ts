import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { PrasadService } from './prasad.service';
import { CreatePrasadOrderDto } from './prasad.dto';

/** Prasad ordering for logged-in users (any role). */
@Controller('prasad')
@UseGuards(AuthGuard)
export class PrasadController {
  constructor(private readonly prasad: PrasadService) {}

  @Post('orders')
  create(@Body() body: CreatePrasadOrderDto, @CurrentUser() user: any) {
    return this.prasad.createOrder(body, user);
  }

  @Get('orders/mine')
  mine(@CurrentUser() user: any) {
    return this.prasad.listMine(user);
  }
}

/** Admin view of prasad orders (fulfilment). */
@Controller('admin/prasad')
@UseGuards(AuthGuard)
@Roles('admin')
export class PrasadAdminController {
  constructor(private readonly prasad: PrasadService) {}

  @Get('orders')
  list(@Query('temple_id') templeId?: string) {
    return this.prasad.adminList(templeId);
  }
}
