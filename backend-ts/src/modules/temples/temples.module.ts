import { Module } from '@nestjs/common';
import {
  TemplesAdminController,
  TemplesController,
} from './temples.controller';
import { TemplesService } from './temples.service';

@Module({
  controllers: [TemplesController, TemplesAdminController],
  providers: [TemplesService],
})
export class TemplesModule {}
