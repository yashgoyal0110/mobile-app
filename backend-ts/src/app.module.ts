import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { DB_NAME, MONGO_URL } from './config/constants';
import { DatabaseModule } from './db/database.module';
import { CommonModule } from './common/common.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SeedModule } from './seed/seed.module';
import { AppController } from './app.controller';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FareConfigModule } from './modules/config/config.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { RidesModule } from './modules/rides/rides.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { AdminModule } from './modules/admin/admin.module';
import { GeoModule } from './modules/geo/geo.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { StaysModule } from './modules/stays/stays.module';
import { TemplesModule } from './modules/temples/temples.module';

@Module({
  imports: [
    // Load .env into process.env before constants.ts is consumed.
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(MONGO_URL, { dbName: DB_NAME }),
    DatabaseModule,
    CommonModule,
    RealtimeModule,
    SeedModule,
    // Feature modules
    AuthModule,
    UsersModule,
    FareConfigModule,
    DriversModule,
    RidesModule,
    SuggestionsModule,
    AdminModule,
    GeoModule,
    RatingsModule,
    StaysModule,
    TemplesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
