/**
 * Production logging stack (pino via nestjs-pino).
 *
 * - Structured JSON logs to stdout in production (NODE_ENV=production) — ready
 *   for Docker / Cloud logging / any aggregator. Pretty, colourised, single-line
 *   logs in development.
 * - Automatic per-request access logging with a correlation id (`reqId`),
 *   method, url, status code and response time. Health checks are skipped to
 *   keep load-balancer pings out of the logs.
 * - Secrets & PII are redacted (auth headers, tokens, OTP, KYC documents).
 * - Every Nest `Logger` instance (`new Logger('context')`) is routed through
 *   pino once `app.useLogger(...)` is wired in main.ts, so all existing service
 *   logs become structured automatically.
 *
 * Env knobs: LOG_LEVEL (default: info in prod, debug otherwise), NODE_ENV.
 */
import { randomUUID } from 'crypto';
import { LoggerModule } from 'nestjs-pino';

const isProd = process.env.NODE_ENV === 'production';

export const AppLoggerModule = LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),

    // Correlation id per request: reuse an inbound X-Request-Id if present,
    // otherwise mint one. Echoed back on the response so clients/proxies can
    // stitch traces together.
    genReqId: (req, res) => {
      const incoming =
        (req.headers['x-request-id'] as string) ||
        (req.headers['x-correlation-id'] as string);
      const id = incoming || randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },

    autoLogging: {
      // Don't log liveness/readiness probes — they'd flood the logs.
      ignore: (req) => (req.url || '').endsWith('/api/health'),
    },

    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} - ${err?.message}`,

    // Keep request/response logs compact: id, verb, path, status, timing — but
    // never the body (KYC payloads carry base64 photos & Aadhaar numbers).
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },

    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-auth-token"]',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ],
      remove: false,
    },

    // Pretty in dev; raw JSON in prod (pino-pretty is a devDependency and is
    // pruned from the production image, so it must never be referenced there).
    transport: isProd
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
  },
});
