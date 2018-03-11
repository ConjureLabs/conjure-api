const Route = require('@conjurelabs/route');

const route = new Route({
  requireAuthentication: false
});

route.push((req, res) => {
  res.send('pong');
});

module.exports = route;
