const Route = require('conjure-core/classes/Route');
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;
const log = require('conjure-core/modules/log')('onboard billing');

const route = new Route({
  requireAuthentication: true
});

route.push((req, res, next) => {
  const apiAccountCardCreation = require('../../account/card/post.js').call;
  apiAccountCardCreation(req, req.body, (err, result) => {
    if (err) {
      return next(err);
    }

    res.send(result);
  });
});

module.exports = route;
