const Route = require('route');
const { ContentError, UnexpectedError } = require('err');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  const apiAccountBillingPlanCreation = require('../../../account/billing/plan/put.js').call;
  const result = await apiAccountBillingPlanCreation(req, req.body);
  return res.send(result);
});

module.exports = route;
