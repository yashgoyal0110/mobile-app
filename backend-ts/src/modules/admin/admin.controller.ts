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
import { AdminService } from './admin.service';
import { LandmarkDto, LandmarkUpdateDto } from './admin.dto';

@Controller('admin')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Patch('config/fare')
  updateFareConfig(@Body() payload: Record<string, any>) {
    return this.admin.updateFareConfig(payload);
  }

  @Get('landmarks')
  listLandmarks() {
    return this.admin.listLandmarks();
  }

  @Post('landmarks')
  addLandmark(@Body() body: LandmarkDto) {
    return this.admin.addLandmark(body);
  }

  @Patch('landmarks/:lid')
  updateLandmark(@Param('lid') lid: string, @Body() body: LandmarkUpdateDto) {
    return this.admin.updateLandmark(lid, body);
  }

  @Delete('landmarks/:lid')
  deleteLandmark(@Param('lid') lid: string) {
    return this.admin.deleteLandmark(lid);
  }

  @Get('drivers')
  listDrivers(@Query('status_filter') statusFilter?: string) {
    return this.admin.listDrivers(statusFilter);
  }

  @Post('drivers/:driverUserId/approve')
  approveDriver(@Param('driverUserId') driverUserId: string) {
    return this.admin.approveDriver(driverUserId);
  }

  @Post('drivers/:driverUserId/reject')
  rejectDriver(
    @Param('driverUserId') driverUserId: string,
    @Body() body: any,
  ) {
    return this.admin.rejectDriver(driverUserId, body);
  }

  @Get('audit/rides')
  auditRides(
    @Query('status_filter') statusFilter?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.auditRides(statusFilter, limit ? Number(limit) : 100);
  }

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('reports/timeseries')
  reportTimeseries(@Query('days') days?: string) {
    return this.admin.reportTimeseries(days ? Number(days) : 7);
  }

  @Get('reports/leaderboard')
  reportLeaderboard(@Query('limit') limit?: string) {
    return this.admin.reportLeaderboard(limit ? Number(limit) : 10);
  }

  @Get('reports/top-routes')
  reportTopRoutes(@Query('limit') limit?: string) {
    return this.admin.reportTopRoutes(limit ? Number(limit) : 10);
  }

  @Get('withdrawals')
  listWithdrawals() {
    return this.admin.listWithdrawals();
  }

  @Post('withdrawals/:wid/mark-paid')
  markWithdrawalPaid(@Param('wid') wid: string) {
    return this.admin.markWithdrawalPaid(wid);
  }
}
