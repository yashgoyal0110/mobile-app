import { Module } from '@nestjs/common';
import {
  RatingsAdminController,
  RatingsController,
} from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  controllers: [RatingsController, RatingsAdminController],
  providers: [RatingsService],
})
export class RatingsModule {}
