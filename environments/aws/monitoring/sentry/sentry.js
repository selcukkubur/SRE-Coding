const Sentry = require('@sentry/node');

const initSentry = () => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Postgres(),
    ],
    beforeSend(event) {
      // Remove sensitive information
      if (event.request && event.request.data) {
        delete event.request.data.password;
        delete event.request.data.token;
      }
      return event;
    },
  });
};

const captureError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    scope.setExtra('context', context);
    Sentry.captureException(error);
  });
};

module.exports = {
  initSentry,
  captureError,
};
