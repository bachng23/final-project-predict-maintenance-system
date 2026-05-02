/**
 * Request context utility for tracing
 */

const { AsyncLocalStorage } = require('node:async_hooks');
const { v4: uuidv4 } = require('uuid');

const requestContextStorage = new AsyncLocalStorage();

const generateRequestId = () => uuidv4();

const runWithRequestContext = (requestId, callback) => {
    return requestContextStorage.run({ requestId }, callback);
};

const setRequestId = (requestId) => {
    const store = requestContextStorage.getStore();

    if (store) {
        store.requestId = requestId;
    }
};

const getRequestId = () => {
    const store = requestContextStorage.getStore();
    return store?.requestId || null;
};

module.exports = {
    generateRequestId,
    runWithRequestContext,
    setRequestId,
    getRequestId,
};
