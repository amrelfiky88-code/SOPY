// Express 4 ignores promises returned by route handlers, so an error
// thrown inside an async handler becomes an unhandled rejection — which
// on current Node kills the whole process instead of failing one request.
// Forward those rejections to the error middleware, as Express 5 does.
import Layer from 'express/lib/router/layer.js';

Layer.prototype.handle_request = function handleRequest(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next(); // error-handling middleware; not for normal requests
  try {
    const result = fn(req, res, next);
    if (result && typeof result.catch === 'function') result.catch(next);
  } catch (err) {
    next(err);
  }
};
