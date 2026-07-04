import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { RidesService } from './rides.service';
import { CancelDto, CreateRideDto, TipDto, VerifyPinDto } from './rides.dto';

@Controller('rides')
@UseGuards(AuthGuard)
export class RidesController {
  constructor(private readonly rides: RidesService) {}

  @Post()
  @Roles('passenger')
  createRide(@Body() body: CreateRideDto, @CurrentUser() user: any) {
    return this.rides.createRide(body, user);
  }

  @Get('mine')
  myRides(@CurrentUser() user: any) {
    return this.rides.myRides(user);
  }

  @Get(':rideId')
  getRide(@Param('rideId') rideId: string, @CurrentUser() user: any) {
    return this.rides.getRide(rideId, user);
  }

  @Post(':rideId/accept')
  @Roles('driver')
  accept(@Param('rideId') rideId: string, @CurrentUser() user: any) {
    return this.rides.acceptRide(rideId, user);
  }

  @Post(':rideId/verify-pin')
  @Roles('driver')
  verifyPin(
    @Param('rideId') rideId: string,
    @Body() body: VerifyPinDto,
    @CurrentUser() user: any,
  ) {
    return this.rides.verifyPin(rideId, body, user);
  }

  @Post(':rideId/complete')
  @Roles('driver')
  complete(@Param('rideId') rideId: string, @CurrentUser() user: any) {
    return this.rides.completeRide(rideId, user);
  }

  @Post(':rideId/tip')
  @Roles('passenger')
  tip(
    @Param('rideId') rideId: string,
    @Body() body: TipDto,
    @CurrentUser() user: any,
  ) {
    return this.rides.addTip(rideId, body, user);
  }

  @Post(':rideId/cancel')
  cancel(
    @Param('rideId') rideId: string,
    @Body() body: CancelDto,
    @CurrentUser() user: any,
  ) {
    return this.rides.cancelRide(rideId, body, user);
  }
}
