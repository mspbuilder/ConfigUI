const pino = require('pino');
const crypto = require('crypto');

// Create base logger with pretty printing in dev, JSON in production
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  base: { service: 'config-api' },
  timestamp: pino.stdTimeFunctions.isoTime
});

// Generate short request ID
function generateRequestId() {
  return crypto.randomBytes(4).toString('hex');
}

// Create child logger with source file context
function createLogger(filename) {
  const source = filename.replace(/^.*[\\\/]/, ''); // Extract just filename
  return {
    info: (msg, data = {}) => logger.info({ source, ...data }, msg),
    error: (msg, data = {}) => logger.error({ source, ...data }, msg),
    warn: (msg, data = {}) => logger.warn({ source, ...data }, msg),
    debug: (msg, data = {}) => logger.debug({ source, ...data }, msg),

    // Create request-scoped logger
    child: (reqId, extra = {}) => ({
      info: (msg, data = {}) => logger.info({ source, reqId, ...extra, ...data }, msg),
      error: (msg, data = {}) => logger.error({ source, reqId, ...extra, ...data }, msg),
      warn: (msg, data = {}) => logger.warn({ source, reqId, ...extra, ...data }, msg),
      debug: (msg, data = {}) => logger.debug({ source, reqId, ...extra, ...data }, msg)
    })
  };
}

// Express middleware to add request ID and logger to req
function requestLogger(req, res, next) {
  req.id = req.headers['x-request-id'] || generateRequestId();
  req.log = createLogger('request').child(req.id, {
    method: req.method,
    path: req.path
  });

  // Log request start
  req.log.info('Request started');

  // Log response on finish
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.log.info('Request completed', {
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
}

module.exports = {
  logger,
  createLogger,
  requestLogger,
  generateRequestId
};
