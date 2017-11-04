const Route = require('conjure-core/classes/Route');

const route = new Route({
  requireAuthentication: false
});

route.push((req, res, next) => {
  res.send('pong');
});

module.exports = route;
