const async = require('async');
const Loggly = require('loggly');
const loggingTools = require('auth0-log-extension-tools');
const config = require('../lib/config');
const logger = require('../lib/logger');

module.exports = (storage) =>
  (req, res, next) => {
    const wtBody = (req.webtaskContext && req.webtaskContext.body) || req.body || {};
    const wtHead = (req.webtaskContext && req.webtaskContext.headers) || {};
    const isCron = (wtBody.schedule && wtBody.state === 'active') || (wtHead.referer === 'https://manage.auth0.com/' && wtHead['if-none-match']);

    if (!isCron) {
      return next();
    }

    const loggly = Loggly.createClient({
      token: config('LOGGLY_CUSTOMER_TOKEN'),
      subdomain: config('LOGGLY_SUBDOMAIN') || '-',
      tags: ['auth0']
    });

    const onLogsReceived = (logs, callback) => {
      if (!logs || !logs.length) {
        return callback();
      }

      logger.info(`Sending ${logs.length} logs to Loggly.`);

      loggly.log(logs, (err) => {
        if (err) {
          logger.info('Error sending logs to Loggly', err);
          return callback(err);
        }

        logger.info('Upload complete.');

        return callback();
      });
    };

    const slack = new loggingTools.reporters.SlackReporter({
      hook: config('SLACK_INCOMING_WEBHOOK_URL'),
      username: 'auth0-logs-to-loggly',
      title: 'Logs To Loggly'
    });

    const options = {
      domain: config('AUTH0_DOMAIN'),
      clientId: config('AUTH0_CLIENT_ID'),
      clientSecret: config('AUTH0_CLIENT_SECRET'),
      batchSize: config('BATCH_SIZE'),
      startFrom: config('START_FROM'),
      logLevel: config('LOG_LEVEL'),
      logTypes: config('LOG_TYPES')
    };

    const auth0logger = new loggingTools.LogsProcessor(storage, options);

    return auth0logger
      .run(onLogsReceived)
      .then(result => {
        slack.send(result.status, result.checkpoint);
        res.json(result);
      })
      .catch(err => {
        slack.send({ error: err, logsProcessed: 0 }, null);
        next(err);
      });
  };
