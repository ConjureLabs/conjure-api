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

  // todo: assumes account has a github record in our db - we should have more handlers for services like bitbucket
  const apiGetAccountGitHub = require('conjure-api/server/routes/api/account/github/get.js').direct;
  apiGetAccountGitHub(req, null, (err, result) => {
    if (err) {
      return next(err);
    }

    const githubAccount = result.account;

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

      // todo: stop sending by org all the time - it's an overhead most of the time
      res.send({
        reposByOrg: reposByOrg
      });
    });
  });
});

module.exports = route;
