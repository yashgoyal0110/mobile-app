import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { DriversService } from './drivers.service';
import { KycDto, LocationDto, OnlineDto, WithdrawDto } from './drivers.dto';

@Controller('drivers')
@UseGuards(AuthGuard)
@Roles('driver')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Post('kyc')
  submitKyc(@Body() body: KycDto, @CurrentUser() user: any) {
    return this.drivers.submitKyc(body, user);
  }

  @Post('online')
  setOnline(@Body() body: OnlineDto, @CurrentUser() user: any) {
    return this.drivers.setOnline(body, user);
  }

  @Post('location')
  updateLocation(@Body() body: LocationDto, @CurrentUser() user: any) {
    return this.drivers.updateLocation(body, user);
  }

  @Get('incoming-rides')
  incomingRides(@CurrentUser() user: any) {
    return this.drivers.incomingRides(user);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: any) {
    return this.drivers.earnings(user);
  }

  @Post('withdraw')
  withdraw(@Body() body: WithdrawDto, @CurrentUser() user: any) {
    return this.drivers.withdraw(body, user);
  }
}
