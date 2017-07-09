const Route = require('conjure-core/classes/Route');
const ContentError = require('conjure-core/modules/err').ContentError;

const route = new Route({
  requireAuthentication: true
});

route.push((req, res, next) => {
  if (!req.body.label || !req.body.value) {
    return next(new ContentError('Payload missing or in an unexpected format'));
  }
  res.cookie('conjure-onboard-orgs', req.body, {
    maxAge: 259200000, // 3 days
    httpOnly: true
  });

  res.send({});
});

module.exports = route;
