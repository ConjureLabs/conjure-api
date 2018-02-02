const Route = require('route');

const route = new Route({
  requireAuthentication: false
});

route.push((req, res) => {
  res.send('pong');
});

module.exports = route;
