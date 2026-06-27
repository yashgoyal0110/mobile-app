import { Module } from '@nestjs/common';
import {
  StaysAdminController,
  StaysController,
} from './stays.controller';
import { StaysService } from './stays.service';

@Module({
  controllers: [StaysController, StaysAdminController],
  providers: [StaysService],
})
export class StaysModule {}
