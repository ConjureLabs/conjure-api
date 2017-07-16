const Route = require('conjure-core/classes/Route');
const ContentError = require('conjure-core/modules/err').ContentError;

const route = new Route({
  requireAuthentication: true
});

route.push((req, res, next) => {
  if (!Array.isArray(req.body)) {
    return next(new ContentError('Payload missing or in an unexpected format'));
  }

  const waterfall = [];

  // getting all user repos
  waterfall.push(callback => {
    const apiGetRepos = require('../../../repos/get.js').direct;
    apiGetRepos(req, null, (err, result) => {
      if (err) {
        return callback(err);
      }

      callback(null, result.reposByOrg);
    });
  });

  // filter full repo listing down to those user selected
  waterfall.push((reposByOrg, callback) => {
    // filtering down to repos selected
    const repos = [];
    const orgs = Object.keys(reposByOrg);
    const selections = req.body.slice(); // slice to ensure native array

    for (let i = 0; i < orgs.length; i++) {
      const org = orgs[i];

      for (let j = 0; j < reposByOrg[org].length; j++) {
        const repo = reposByOrg[org][j];

        if (!selections.includes(repo.id)) {
          continue;
        }

        repos.push(repo);
      }
    }

    if (!repos.length) {
      return callback(new ContentError('No repos selected'));
    }

    callback(null, repos);
  });

  // enable watching of each
  waterfall.push((repos, callback) => {
    const parallel = repos.map(repo => {
      return cb => {
        const apiWatchRepo = require('../../../repo/watch/post.js').direct;
        apiWatchRepo(req, {
          service: repo.service.toLowerCase(), // keep lower?
          url: repo.url,
          name: repo.name,
          fullName: repo.fullName,
          orgName: repo.org,
          repoName: repo.name,
          githubId: repo.id,
          isPrivate: repo.private,
          vm: 'web' // forced to web for now
        }, err => {
          cb(err);
        });
      };
    });

    const async = require('async');
    async.parallelLimit(parallel, 3, callback);
  });

  // mark account as onboarded
  waterfall.push((repos, callback) => {
    const DatabaseTable = require('conjure-core/classes/DatabaseTable');
    const account = new DatabaseTable('account');

    account.update({
      onboarded: true,
      updated: new Date()
    }, {
      id: req.user.id
    }, err => {
      callback(err, repos);
    });
  });

  const asyncWaterfall = require('conjure-core/modules/async/waterfall');
  asyncWaterfall(waterfall, err => {
    if (err) {
      return next(err);
    }

    // all good
    res.send({});
  });
});

module.exports = route;

