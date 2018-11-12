const request = require('request');
const logdna = require('logdna');
const ProcessLogs = require('./processLogs');

const config = getConfig();

const options = {
  host: config.host,
  appname: config.appname
}

const logger = logdna.setupDefaultLogger(config.key, options);

function sendLogs(logs, callback) {
  if (logs.length === 0) {
    callback();
  }

  const messages = {
    "lines": []
  };

  let i = 0;
  let messages = logs.map(entry => {
    logger.debug(`auth0 log #${i++}`);
    logger.debug(JSON.stringify(entry));

    let single = {
      "app": config.appname
    };
    single.line=JSON.stringify(entry);
    return single;
  });

  request({
    method: 'POST',
    timeout: 2000,
    url: config.url,
    headers: {'apikey': config.key, 'cache-control': 'no-cache', 'Content-Type': 'application/json' },
    body: messages,
    json: true
  }, (error, response, body) => {
    logger.debug('error:', error);
    logger.debug('statusCode:', response && response.statusCode);
    logger.debug('body:', body);

    const isError = !!error || response.statusCode < 200 || response.statusCode >= 400;

    if (isError) {
      return callback(error || response.error || response.body);
    }

    return callback();
  });
}

function LogdnaLogging (host, key, app) {
  if (!host) {
    throw new Error('HOSTNAME is required for Logdna');
  }

  if (!key) {
    throw new Error('LOGDNA_INGESTION_KEY is required for Logdna');
  }

  if (!app) {
    throw new Error('LOGDNA_APP_NAME is required for Logdna');
  }
}

LogdnaLogging.prototype.send = function(logs, callback) {
  if (!logs || !logs.length) {
    return callback();
  }

  return sendLogs(logs, callback);
};

module.exports = LogdnaLogging;
