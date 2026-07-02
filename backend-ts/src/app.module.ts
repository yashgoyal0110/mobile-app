import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { DB_NAME, MONGO_URL } from './config/constants';
import { AppLoggerModule } from './logging/logging.module';
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
import { AdminModule } from './modules/admin/admin.module';
import { GeoModule } from './modules/geo/geo.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { StaysModule } from './modules/stays/stays.module';
import { TemplesModule } from './modules/temples/temples.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { PrasadModule } from './modules/prasad/prasad.module';

@Module({
  imports: [
    // Load .env into process.env before constants.ts is consumed.
    ConfigModule.forRoot({ isGlobal: true }),
    // Structured request + application logging (pino). Global.
    AppLoggerModule,
    // autoIndex/autoCreate off: index management is owned solely by
    // SeedService.ensureIndexes(). This stops Mongoose from auto-building a
    // (non-unique) `id_1` that would collide with the seed's unique `id_1`, and
    // avoids per-boot index churn in production.
    MongooseModule.forRoot(MONGO_URL, {
      dbName: DB_NAME,
      autoIndex: false,
      autoCreate: false,
    }),
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
    AdminModule,
    GeoModule,
    RatingsModule,
    StaysModule,
    TemplesModule,
    UploadsModule,
    PrasadModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
