const Route = require('conjure-core/classes/Route');
const ContentError = require('conjure-core/modules/err').ContentError;

const route = new Route();

route.push((req, res, next) => {
  // need to add billing
  res.send({});
});

module.exports = route;
