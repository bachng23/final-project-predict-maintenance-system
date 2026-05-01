/**
 * Request context utility for tracing
 */

const { v4: uuidv4 } = require('uuid');

let requestId = null;

const generateRequestId = () => uuidv4();

const setRequestId = (id) => {
    requestId = id;
};

const getRequestId = () => requestId;

module.exports = {
    generateRequestId,
    setRequestId,
    getRequestId,
};
