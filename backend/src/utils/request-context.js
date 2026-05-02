const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

function runWithRequestContext(context, callback) {
  return asyncLocalStorage.run(context, callback);
}

function getRequestContext() {
  return asyncLocalStorage.getStore() || {};
}

function getRequestId() {
  return getRequestContext().requestId || null;
}

function setRequestContext(partialContext) {
  const context = asyncLocalStorage.getStore();

  if (context) {
    Object.assign(context, partialContext);
  }
}

module.exports = {
  asyncLocalStorage,
  runWithRequestContext,
  getRequestContext,
  getRequestId,
  setRequestContext
};