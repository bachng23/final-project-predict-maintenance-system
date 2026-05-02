/**
 * Middleware to attach request ID to all requests
 */

const { generateRequestId, runWithRequestContext, setRequestId } = require('../utils/request-context');

const requestContextMiddleware = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    res.setHeader('X-Request-ID', requestId);
    req.requestId = requestId;

    runWithRequestContext(requestId, () => {
        setRequestId(requestId);
        next();
    });
};

module.exports = requestContextMiddleware;
