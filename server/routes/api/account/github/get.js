const Route = require('route');
const { UnexpectedError } = require('err');

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push(async (req, res) => {
  const DatabaseTable = require('db/table');
  const accountGithub = new DatabaseTable('account_github');

  const rows = await accountGithub.select({
    account: req.user.id
  });

  // should not be possible
  if (!rows.length) {
    throw new UnexpectedError('Could not find GitHub account record');
  }

  // should not be possible
  if (rows.length > 1) {
    throw new UnexpectedError('Expected a single row for GitHub account record, received multiple');
  }

  return res.send({
    account: rows[0]
  });
});

module.exports = route;
