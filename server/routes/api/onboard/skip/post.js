const Route = require('conjure-core/classes/Route');
const NotFoundError = require('conjure-core/modules/err').NotFoundError;
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;

const route = new Route({
  requireAuthentication: true
});

route.push((req, res, next) => {
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const account = new DatabaseTable('account');

  account.select({
    id: req.user.id
  }, (err, rows) => {
    if (err) {
      return next(err);
    }

    // record does not exist in our db - should not happen
    if (!rows.length) {
      return next(new NotFoundError('Account not found'));
    }

    // checking if user should be able to do this
    if (rows[0].onboarded === true) {
      return next(new UnexpectedError('Account already onboarded'));
    }

    rows[0].onboarded = true;
    rows[0].updated = new Date();

    rows[0].save(err => {
      if (err) {
        return next(err);
      }

      res.send({});
    });
  });
});

module.exports = route;
