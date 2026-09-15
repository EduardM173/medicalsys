const { paginationContext, parsePagination } = require('../context/pagination.context');
module.exports = function paginationScope(request, response, next) {
  if (request.method !== 'GET') return next();
  const scope = parsePagination(request.query);
  const json = response.json.bind(response);
  response.json = (body) => {
    if (Object.keys(scope.results).length) response.setHeader('X-Pagination', JSON.stringify(scope.results));
    return json(body && !Array.isArray(body) && Object.keys(scope.results).length
      ? { ...body, pagination: scope.results } : body);
  };
  paginationContext.run(scope, next);
};
