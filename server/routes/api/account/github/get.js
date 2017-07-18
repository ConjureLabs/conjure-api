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
  const accountGithub = new DatabaseTable('account_github');

  if (!req.user) {
    return next(new UnexpectedError('No req.user available'));
  }

  accountGithub.select({
    account: req.user.id
  }, (err, rows) => {
    if (err) {
      return next(err);
    }

    // should not be possible
    if (!rows.length) {
      return next(new UnexpectedError('Could not find GitHub account record'));
    }

    // should not be possible
    if (rows.length > 1) {
      return next(new UnexpectedError('Expected a single row for GitHub account record, received multiple'));
    }

    res.send({
      account: rows[0]
    });
  });
});

module.exports = route;
