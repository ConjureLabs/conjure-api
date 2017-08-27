const Route = require('conjure-core/classes/Route');
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push((req, res, next) => {
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const accountCard = new DatabaseTable('account_card');

  if (!req.user) {
    return next(new UnexpectedError('No req.user available'));
  }

  accountCard.select({
    account: req.user.id
  }, (err, rows) => {
    if (err) {
      return next(err);
    }

    res.send({
      cards: rows
    });
  });
});

module.exports = route;
