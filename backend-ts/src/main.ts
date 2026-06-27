import 'reflect-metadata';
import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { WebSocketServer } from 'ws';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { WsHandler } from './realtime/ws.handler';
import { PORT } from './config/constants';

async function bootstrap() {
  // bufferLogs: hold early logs until the pino logger is wired, so nothing is
  // emitted through the default console logger.
  const app = await NestFactory.create(AppModule, {
    cors: false,
    bufferLogs: true,
  });

  // Route Nest's internal logs (and every `new Logger(ctx)` in the app) through
  // pino, so all output is structured and consistent.
  app.useLogger(app.get(PinoLogger));

  const logger = new NestLogger('fifthdigit');

  // All business routes live under /api (mirrors FastAPI APIRouter(prefix="/api")).
  app.setGlobalPrefix('api');

  // CORS — same permissive config as the Python backend.
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: '*',
    allowedHeaders: '*',
  });

  // DTO validation + transformation (mirrors Pydantic): strip unknown fields,
  // apply declared defaults, coerce types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Reshape every error to FastAPI's { detail } form (frontend reads data.detail).
  app.useGlobalFilters(new AllExceptionsFilter());

  // ---- Raw WebSocket endpoint at /api/ws ----
  // The Expo client opens a plain WebSocket and exchanges bare `{type:...}` JSON,
  // so we attach our own ws server to the HTTP upgrade event rather than using a
  // Nest WebSocketGateway (which expects an {event,data} envelope).
  const wsHandler = app.get(WsHandler);
  const wss = new WebSocketServer({ noServer: true });
  const httpServer = app.getHttpServer();
  httpServer.on('upgrade', (req: any, socket: any, head: any) => {
    let pathname = '';
    let token: string | null = null;
    try {
      const parsed = new URL(req.url, 'http://localhost');
      pathname = parsed.pathname;
      token = parsed.searchParams.get('token');
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== '/api/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wsHandler.handleConnection(ws, token).catch((e) => {
        logger.warn(`WS upgrade handler failed: ${e}`);
        try {
          ws.close();
        } catch {
          /* noop */
        }
      });
    });
  });

  await app.listen(PORT, '0.0.0.0');
  logger.log(`FifthDigit API listening on :${PORT}`);
}

bootstrap();
