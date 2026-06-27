import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';
import { WsHandler } from './ws.handler';

@Global()
@Module({
  providers: [RealtimeService, WsHandler],
  exports: [RealtimeService, WsHandler],
})
export class RealtimeModule {}
