const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;

const handlers = [];

/*
  Repos listing
 */
handlers.push((req, res, next) => {
  const UniqueArray = require('conjure-core/classes/Array/UniqueArray');
  const GitHubRepo = require('conjure-core/classes/Repo/GitHub');
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const accountGithub = new DatabaseTable('account_github');

  // todo: assumes account has a github record in our db - we should have more handlers for services like bitbucket
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

    const githubAccount = rows[0];

    const github = require('octonode');
    const githubClient = github.client(githubAccount.access_token);

    githubClient.get('/user/orgs', {}, (err, status, body) => {
      if (err) {
        return next(err);
      }

      const allOrgs = body;

      allOrgs.push(req.user.username);


      res.send({
        orgs: allOrgs
      });
    });
  });
});

module.exports = handlers;
