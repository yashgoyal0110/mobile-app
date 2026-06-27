/**
 * Registers every Mongoose model once and re-exports MongooseModule so any
 * feature module can `imports: [DatabaseModule]` and `@InjectModel(...)` the
 * collections it needs. Keeps model registration in a single place.
 */
import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './schemas/user.schema';
import { Driver, DriverSchema } from './schemas/driver.schema';
import { Ride, RideSchema } from './schemas/ride.schema';
import { FareConfig, FareConfigSchema } from './schemas/fare-config.schema';
import {
  FareSuggestion,
  FareSuggestionSchema,
} from './schemas/fare-suggestion.schema';
import { Complaint, ComplaintSchema } from './schemas/complaint.schema';
import { Rating, RatingSchema } from './schemas/rating.schema';
import { Stay, StaySchema } from './schemas/stay.schema';
import { Temple, TempleSchema } from './schemas/temple.schema';
import { Withdrawal, WithdrawalSchema } from './schemas/withdrawal.schema';

const models = MongooseModule.forFeature([
  { name: User.name, schema: UserSchema },
  { name: Driver.name, schema: DriverSchema },
  { name: Ride.name, schema: RideSchema },
  { name: FareConfig.name, schema: FareConfigSchema },
  { name: FareSuggestion.name, schema: FareSuggestionSchema },
  { name: Complaint.name, schema: ComplaintSchema },
  { name: Rating.name, schema: RatingSchema },
  { name: Stay.name, schema: StaySchema },
  { name: Temple.name, schema: TempleSchema },
  { name: Withdrawal.name, schema: WithdrawalSchema },
]);

@Global()
@Module({
  imports: [models],
  exports: [models],
})
export class DatabaseModule {}
