import type { ErrorRequestHandler, Request, RequestHandler } from 'express';

/**
 * Structured logging, request logging and error handling.
 *
 * Cloud Run captures stdout and Cloud Logging parses each line as JSON when the
 * line is valid JSON, promoting `severity` and `httpRequest` to real log fields
 * you can filter on. Entries that additionally carry the ReportedErrorEvent
 * `@type` and a stack trace in `message` are picked up by Error Reporting,
 * which groups repeated occurrences into a single issue.
 *
 * Locally (NODE_ENV !== 'production') the same calls print as readable single
 * lines instead, so `npm run dev` output stays legible.
 */

type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

const ERROR_EVENT_TYPE =
  'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';

const asJson = process.env.NODE_ENV === 'production';

/** Paths that would otherwise flood the logs with no diagnostic value. */
const SKIP_LOGGING = ['/api/health', '/assets/', '/@', '/src/', '/node_modules/'];

export function log(severity: Severity, message: string, fields: Record<string, unknown> = {}) {
  if (!asJson) {
    const extra = Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : '';
    console.log(`[${severity}] ${message}${extra}`);
    return;
  }
  console.log(JSON.stringify({ severity, message, ...fields }));
}

/**
 * Records an exception so Error Reporting can group it. `message` must carry the
 * stack trace — that is what Error Reporting parses to work out where it came
 * from and which occurrences belong together.
 */
export function reportError(err: unknown, req?: Request) {
  const error = err instanceof Error ? err : new Error(String(err));
  log('ERROR', error.stack || `${error.name}: ${error.message}`, {
    '@type': ERROR_EVENT_TYPE,
    ...(req
      ? {
          context: {
            httpRequest: {
              method: req.method,
              url: req.originalUrl,
              responseStatusCode: 500,
              userAgent: req.get('user-agent'),
              remoteIp: req.ip,
            },
          },
        }
      : {}),
  });
}

/**
 * Logs one line per request once the response is finished. Request bodies are
 * never logged — they carry passwords, OTP codes and chat content.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  if (SKIP_LOGGING.some(prefix => req.path.startsWith(prefix))) return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const severity: Severity =
      res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARNING' : 'INFO';

    // No @type here: the error handler reports the exception itself, and
    // double-reporting would inflate Error Reporting's occurrence counts.
    log(severity, `${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(ms)}ms`, {
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        status: res.statusCode,
        latency: `${(ms / 1000).toFixed(3)}s`,
        userAgent: req.get('user-agent'),
        remoteIp: req.ip,
      },
      userId: (req.session as any)?.userId ?? null,
    });
  });

  next();
};

/**
 * Last-resort handler for anything a route throws or passes to next(). Without
 * it Express's default handler answers with an HTML stack trace and writes
 * nothing to the logs.
 *
 * Must be registered after every route.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Headers already flushed — the response is committed, so hand back to
  // Express's default handler, which destroys the socket.
  if (res.headersSent) return next(err);

  // Middleware such as express.json() marks client faults with a status:
  // malformed JSON is 400, an oversized body 413. Reporting those as server
  // errors would let any bot sending junk fill up Error Reporting.
  const status = Number((err as any)?.status ?? (err as any)?.statusCode) || 500;

  if (status >= 500) {
    reportError(err, req);
  } else {
    const e = err instanceof Error ? err : new Error(String(err));
    log('WARNING', `${req.method} ${req.originalUrl} rejected: ${e.name}: ${e.message}`, {
      httpRequest: { requestMethod: req.method, requestUrl: req.originalUrl, status },
    });
  }

  // Matches the shape the API already returns elsewhere, so clients see nothing
  // new. The error's own message is never sent: it can carry a query or the
  // connection string.
  const message = status >= 500 ? 'Internal server error' : 'Invalid request';

  if (req.path.startsWith('/api')) {
    res.status(status).json({ message });
  } else {
    res.status(status).type('text').send(message);
  }
};

/**
 * Catches failures that escape the request cycle entirely.
 *
 * Note this changes how unhandled rejections behave: Node's default is to
 * terminate the process, and from here on they are logged and the server keeps
 * serving. One request's dangling promise should not take the app down for
 * every other farmer using it. Uncaught exceptions still exit — the process
 * state is no longer trustworthy — and Cloud Run starts a replacement.
 */
export function installProcessHandlers() {
  process.on('unhandledRejection', reason => {
    reportError(
      reason instanceof Error ? reason : new Error(`Unhandled promise rejection: ${String(reason)}`)
    );
  });

  process.on('uncaughtException', err => {
    reportError(err);
    log('CRITICAL', '[process] Exiting after uncaught exception');
    process.exitCode = 1;
    // Give the log line a moment to reach stdout before the process goes away.
    setTimeout(() => process.exit(1), 100).unref();
  });
}
