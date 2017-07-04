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

    const async = require('async');
    const allRepos = new UniqueArray('fullName');
    const pullRepos = [];
    let somethingWatched = false;

    // getting all (possibly private) org repos
    pullRepos.push(callback => {
      githubClient.get('/user/orgs', {}, (err, status, body) => {
        if (err) {
          return callback(err);
        }

        const pullOrgRepos = body.map(org => {
          return cb => {
            githubClient
              .org(org.login)
              .repos((err, repos) => {
                if (err) {
                  return cb(err);
                }

                repos = repos.map(repo => new GitHubRepo(repo));

                for (let i = 0; i < repos.length; i++) {
                  allRepos.push(repos[i]);
                }

                cb();
              });
          };
        });

        async.parallelLimit(pullOrgRepos, 4, callback);
      });
    });

    // user repos
    pullRepos.push(callback => {
      githubClient.user(githubAccount.username).repos((err, repos) => {
        if (err) {
          return callback(err);
        }

        repos = repos.map(repo => new GitHubRepo(repo));

        for (let i = 0; i < repos.length; i++) {
          // filter out repos where the user does not have the correct permissions
          // todo: possibly make it apparent via the UI that repos were not shown?
          if (repos[i].permissions.admin !== true) {
            continue;
          }

          allRepos.push(repos[i]);
        }

        callback();
      });
    });

    // run the `pullRepos` parallel logic defined above
    async.parallel(pullRepos, err => {
      if (err) {
        return next(err);
      }

      // todo: pagination - should pull org names, then drill in via UI with api calls, which pages (in UI too)
      const finalRepos = allRepos.native;

      const sortInsensitive = require('conjure-core/modules/utils/Array/sort-insensitive');
      sortInsensitive(finalRepos, 'fullName');

      const reposByOrg = finalRepos.reduce((mapping, current) => {
        const orgRepos = mapping[ current.org ];

        if (!Array.isArray(orgRepos)) {
          mapping[ current.org ] = [ current ];
        } else {
          orgRepos.push(current);
        }

        return mapping;
      }, {});

      res.send({
        reposByOrg: reposByOrg
      });
    });
  });
});

module.exports = handlers;
