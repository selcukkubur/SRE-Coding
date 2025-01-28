const winston = require('winston');
const Sentry = require('@sentry/node');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Optional Sentry integration
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'development',
    tracesSampleRate: 1.0,
  });
}

module.exports = {
  logger,
  captureError: (error, context = {}) => {
    logger.error(error.message, { error, context });
    
    if (process.env.SENTRY_DSN) {
      Sentry.withScope((scope) => {
        scope.setExtra('context', context);
        Sentry.captureException(error);
      });
    }
  },
};
