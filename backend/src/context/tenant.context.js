const { AsyncLocalStorage } = require('node:async_hooks');

const tenantStorage = new AsyncLocalStorage();

function runWithTenant(context, callback) {
  return tenantStorage.run(context, callback);
}

function getTenantContext() {
  return tenantStorage.getStore() || null;
}

module.exports = {
  runWithTenant,
  getTenantContext
};
