import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller()
export class AppController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  root() {
    return { app: 'FifthDigit', status: 'running', version: '1.0.0' };
  }

  @Get('health')
  async health() {
    let dbOk = false;
    try {
      await this.connection.db!.command({ ping: 1 });
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return { status: dbOk ? 'ok' : 'degraded', db: dbOk };
  }
}
