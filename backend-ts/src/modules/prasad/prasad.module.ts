import { Module } from '@nestjs/common';
import { PrasadController, PrasadAdminController } from './prasad.controller';
import { PrasadService } from './prasad.service';

@Module({
  controllers: [PrasadController, PrasadAdminController],
  providers: [PrasadService],
})
export class PrasadModule {}
