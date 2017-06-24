const Route = require('conjure-core/classes/Route');
const ContentError = require('conjure-core/modules/err').ContentError;

const route = new Route();

route.push((req, res, next) => {
  if (!req.body.label || !req.body.value) {
    return next(new ContentError('Payload missing or in an unexpected format'));
  }
  res.cookie('conjure-onboard-orgs', req.body, {
    maxAge: 300000, // ~ 3.5 days
    httpOnly: true
  });

  res.send();
});

module.exports = route;
