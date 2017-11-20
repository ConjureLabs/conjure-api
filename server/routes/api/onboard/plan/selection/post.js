const Route = require('conjure-core/classes/Route');
const { ContentError, UnexpectedError } = require('conjure-core/modules/err');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  const apiAccountBillingPlanCreation = require('../../../account/billing/plan/post.js').call;
  const result = await apiAccountBillingPlanCreation(req, req.body);
  return res.send(result);
});

module.exports = route;
