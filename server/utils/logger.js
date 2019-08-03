const winston = require('winston');
const { createLogger, format, transports } = require('winston');
const mongoose = require('mongoose');
require('winston-mongodb');

const PROD = process.env.NODE_ENV === 'production';

const loggerTransports = [
  new winston.transports.File({
    filename: 'app.log',
    level: 'info',
    maxsize: 5242880, // 5MB
  })
];

// if (!PROD) {
  loggerTransports.push(
    new winston.transports.Console({
      name: 'debug-console',
      level: 'debug',
      handleExceptions: true,
      json: false,
      colorize: true,
      format: format.combine(
        format.colorize(),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          info =>
            `${info.timestamp} ${info.level} ${info.request && info.request.url} ${info.message}
           ${
             info.err instanceof Error
               ? `${info.err.name}:${info.err.message}
               ${info.err.stack}`
               : JSON.stringify(info.err, null, 4)
           }
          `,
        ),
      ),
    }),
  );
// }

exports.logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: loggerTransports,
  exitOnError : false
});



const httpRequestLoggerTransports = [
  new winston.transports.File({
    filename: 'app-http-request.log',
    level: 'info',
    maxsize: 5242880, // 5MB
  }),
];

if (!PROD) {
  httpRequestLoggerTransports.push(
    new winston.transports.Console({
      name: 'debug-console',
      level: 'debug',
      handleExceptions: true,
      json: false,
      colorize: true,
      format: format.combine(
        format.colorize(),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(info => `${info.timestamp} ${info.level} ${info.message.trim()}`),
      ),
    }),
  );
}

exports.httpRequestLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: httpRequestLoggerTransports,
});


exports.addMongoTransports = function(){
  const mongoTransport = new winston.transports.MongoDB({
    level : 'info',
    db : mongoose.connection,
    options : {
      autoReconnect : true,
      connectTimeoutMS: 30000,
      useNewUrlParser: true,
    },
    collection : 'serverLogs',
    capped : true,
    cappedSize : 5000000
  });

  const mongoErrorTransport = new winston.transports.MongoDB({
    level : 'error',
    db : mongoose.connection,
    options : {
      autoReconnect : true,
      connectTimeoutMS: 30000,
      useNewUrlParser: true,
    },
    collection : 'serverErrorLogs',
    capped : true,
    cappedSize : 5000000
  })

  exports.logger.add(mongoTransport);
  exports.logger.exceptions.handle(mongoErrorTransport)
  exports.httpRequestLogger.add(mongoTransport);
}