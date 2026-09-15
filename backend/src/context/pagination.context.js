const { AsyncLocalStorage } = require('node:async_hooks');
const paginationContext = new AsyncLocalStorage();
function parsePagination(input = {}) {
  const integer = (value, fallback, max) => /^\d+$/.test(String(value)) && Number(value) > 0 ? Math.min(Number(value), max) : fallback;
  const modelPages = Object.fromEntries(Object.entries(input).filter(([key]) => /^page_[a-z_]+$/.test(key)).map(([key, value]) => [key.slice(5), integer(value, 1, 100000)]));
  return { page: integer(input.page, 1, 100000), pageSize: integer(input.pageSize, 20, 50), modelPages, results: {} };
}
module.exports = { paginationContext, parsePagination };
