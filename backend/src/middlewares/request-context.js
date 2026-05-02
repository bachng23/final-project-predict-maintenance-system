const { randomUUID } = require('crypto');
const { runWithRequestContext } = require('../utils/request-context');

function requestContextMiddleware(req, res, next) {
  const headerRequestId = req.headers['x-request-id'];
  const requestId =
    typeof headerRequestId === 'string' && headerRequestId.trim()
      ? headerRequestId.trim()
      : randomUUID();

  req.requestId = requestId;

  return runWithRequestContext({ requestId }, () => next());
}

module.exports = requestContextMiddleware;
