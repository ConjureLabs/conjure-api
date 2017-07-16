const Route = require('conjure-core/classes/Route');
const PermissionsError = require('conjure-core/modules/err').PermissionsError;
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;
const ContentError = require('conjure-core/modules/err').ContentError;

const route = new Route({
  requireAuthentication: true
});

// todo: set up a module that handles cases like this
const asyncBreak = {};

route.push((req, res, next) => {
  const config = require('conjure-core/modules/config');
  const async = require('async');

  const {
    service,
    url,
    name,
    fullName,
    orgName,
    repoName,
    githubId,
    isPrivate,
    vm
  } = req.body;

  const waterfall = [];

  const newHookPath = `${config.app.api.publicHost}/hook/github/${orgName}/${repoName}`;

  // get github client
  waterfall.push(callback => {
    const apiGetAccountGitHub = require('../../account/github/get.js').direct;
    apiGetAccountGitHub(req, null, (err, result) => {
      if (err) {
        return next(err);
      }

      const githubAccount = result.account;

      const github = require('octonode');
      const githubClient = github.client(githubAccount.access_token);

      callback(null, githubClient);
    });
  });

  // validate permissions on repo
  waterfall.push((githubClient, callback) => {
    githubClient.repo(`${orgName}/${repoName}`).info((err, info) => { 
      if (err) {
        return callback(err);
      }

      if (!info || !info.permissions) {
        return callback(new ContentError('Unexpected payload'));
      }

      if (info.permissions.admin !== true) {
        return callback(new PermissionsError('Must be admin to enable conjure'));
      }

      callback(null, githubClient, orgName, repoName);
    });
  });

  // validate hook is not already set
  waterfall.push((githubClient, orgName, repoName, callback) => {
    githubClient.org(orgName).repo(repoName).hooks((err, data) => {
      if (err) {
        return callback(err);
      }

      if (!Array.isArray(data)) {
        return callback(null, githubClient, orgName, repoName);
      }

      for (let i = 0; i < data.length; i++) {
        if (data[i].config && data[i].config.url === newHookPath) {
          return upsertWatchedRepoRecord(req, err => {
            callback(err || asyncBreak);
          });
        }
      }

      return callback(null, githubClient, orgName, repoName);
    });
  });

  // create new hook
  waterfall.push((githubClient, orgName, repoName, callback) => {
    githubClient.org(orgName).repo(repoName).hook({
      name: 'web',
      active: true,
      events: ['push', 'pull_request'],
      config: {
        content_type: 'json',
        insecure_ssl: 1, // todo: config this - see https://developer.github.com/v3/repos/hooks/#create-a-hook
        secret: config.services.github.inboundWebhookScret,
        url: newHookPath
      }
    }, err => {
      if (err) {
        console.log(err.body.errors);
      }
      callback(err);
    });
  });

  // save reference to watched repo
  waterfall.push(callback => {
    upsertWatchedRepoRecord(req, callback);
  });

  async.waterfall(waterfall, err => {
    if (err && err !== asyncBreak) {
      return next(err);
    }

    res.send({
      success: true
    });
  });
});

function upsertWatchedRepoRecord(req, callback) {
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');

  const {
    service,
    url,
    orgName,
    name,
    githubId,
    isPrivate,
    vm
  } = req.body;

  DatabaseTable.upsert('watched_repo', {
    account: req.user.id,
    service,
    service_repo_id: githubId,
    url,
    org: orgName,
    name,
    vm,
    private: isPrivate,
    disabled: false,
    added: new Date()
  }, {
    updated: new Date()
  }, {
    service,
    service_repo_id: githubId
  }, err => {
    callback(err);
  });
}

module.exports = route;
