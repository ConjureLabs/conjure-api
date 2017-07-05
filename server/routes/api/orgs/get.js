const Route = require('conjure-core/classes/Route');
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push((req, res, next) => {
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

    /*
  [{ login: 'ConjureLabs',
    id: 1783213,
    url: 'https://api.github.com/orgs/ConjureLabs',
    repos_url: 'https://api.github.com/orgs/ConjureLabs/repos',
    events_url: 'https://api.github.com/orgs/ConjureLabs/events',
    hooks_url: 'https://api.github.com/orgs/ConjureLabs/hooks',
    issues_url: 'https://api.github.com/orgs/ConjureLabs/issues',
    members_url: 'https://api.github.com/orgs/ConjureLabs/members{/member}',
    public_members_url: 'https://api.github.com/orgs/ConjureLabs/public_members{/member}',
    avatar_url: 'https://avatars2.githubusercontent.com/u/1783213?v=3',
    description: '' }]
     */
    githubClient.get('/user/orgs', {}, (err, status, body) => {
      if (err) {
        return next(err);
      }

      const allOrgs = body;

      allOrgs.push({
        id: githubAccount.github_id,
        login: githubAccount.username
      });

      res.send({
        orgs: allOrgs.map(org => {
          return {
            id: org.id,
            login: org.login
          };
        })
      });
    });
  });
});

module.exports = route;
