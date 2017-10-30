const Route = require('conjure-core/classes/Route');
const { ContentError } = require('conjure-core/modules/err');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  if (!req.body.label || !req.body.value) {
    throw new ContentError('Payload missing or in an unexpected format');
  }

  res.cookie('conjure-onboard-orgs', req.body, {
    maxAge: 259200000, // 3 days
    httpOnly: true
  });

  res.send({});
});

module.exports = route;
