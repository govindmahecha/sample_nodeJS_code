const uuidv4 = require('uuid/v4');

const { logger } = require('./../utils/logger');

const PROD = process.env.NODE_ENV === 'production';

module.exports = () => (err, req, res, next) => {
  const errorId = uuidv4();
  let message;
  if (err instanceof Error) {
    message = err.message;
  } else {
    message = 'An error occured when processing request ' + req.originalUrl;
  }

  var error = PROD
    ? {
        status: 'error',
        errorId,
        message,
      }
    : {
        status: 'error',
        errorId,
        timeStamp: err.timeStamp || new Date(),
        message,
        err,
        url: req.originalUrl,
        userId: req.user ? req.user.id : 'Not logged in',
      };

  logger.error('error', error);
  res.status(err.httpStatus || 500).json(error);
};
