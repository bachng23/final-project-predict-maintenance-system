/**
 * Middleware to attach request ID to all requests
 */

const { generateRequestId, setRequestId } = require('../utils/request-context');

const requestContextMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    setRequestId(requestId);
    res.setHeader('X-Request-ID', requestId);
    req.requestId = requestId;
    next();
};

module.exports = requestContextMiddleware;
