const Route = require('conjure-core/classes/Route');
const log = require('conjure-core/modules/log')('onboard billing');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  const apiAccountCardCreation = require('../../account/card/post.js').call;
  const result = await apiAccountCardCreation(req, req.body);
  return res.send(result);
});

module.exports = route;
