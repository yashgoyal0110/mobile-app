import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { RatingsService } from './ratings.service';
import {
  ComplaintDto,
  RateRideDto,
  ResolveComplaintDto,
} from './ratings.dto';

/**
 * User-facing ratings/complaints. Empty controller prefix so the routes keep
 * their original `/rides/...` and `/users/...` shapes from the Python router.
 */
@Controller()
@UseGuards(AuthGuard)
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post('rides/:rideId/rate')
  rate(
    @Param('rideId') rideId: string,
    @Body() body: RateRideDto,
    @CurrentUser() user: any,
  ) {
    return this.ratings.rateRide(rideId, body, user);
  }

  @Get('rides/:rideId/ratings')
  listRideRatings(@Param('rideId') rideId: string, @CurrentUser() user: any) {
    return this.ratings.listRideRatings(rideId, user);
  }

  @Post('rides/:rideId/complaint')
  fileComplaint(
    @Param('rideId') rideId: string,
    @Body() body: ComplaintDto,
    @CurrentUser() user: any,
  ) {
    return this.ratings.fileComplaint(rideId, body, user);
  }

  @Get('users/:userId/rating')
  userRating(@Param('userId') userId: string) {
    return this.ratings.userRating(userId);
  }
}

/** Admin complaints management. Mirrors Python `ratings.admin_router`. */
@Controller('admin')
@UseGuards(AuthGuard)
@Roles('admin')
export class RatingsAdminController {
  constructor(private readonly ratings: RatingsService) {}

  @Get('complaints')
  listComplaints(@Query('status_filter') statusFilter = 'open') {
    return this.ratings.listComplaints(statusFilter);
  }

  @Patch('complaints/:cid')
  resolveComplaint(
    @Param('cid') cid: string,
    @Body() body: ResolveComplaintDto,
    @CurrentUser() user: any,
  ) {
    return this.ratings.resolveComplaint(cid, body, user);
  }
}
