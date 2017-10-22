const Route = require('conjure-core/classes/Route');
const { ContentError, PermissionsError } = require('conjure-core/modules/err');

const route = new Route({
  requireAuthentication: true
});

// todo: set up a module that handles cases like this
const asyncBreak = {};

route.push(async (req, res) => {
  const config = require('conjure-core/modules/config');

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

  const newHookPath = `${config.app.api.protocol}://${config.app.api.publicDomain}/hook/github/${orgName}/${repoName}`;

  // get github client
  const apiGetAccountGitHub = require('../../account/github/get.js').call;
  const githubAccount = (await apiGetAccountGitHub(req)).account;

  // prepare github api client
  const github = require('octonode');
  const githubClient = github.client(githubAccount.access_token);

  // validate permissions on repo
  githubClient.repo(`${orgName}/${repoName}`).info((err, info) => { 
    if (err) {
      throw err;
    }

    if (!info || !info.permissions) {
      throw new ContentError('Unexpected payload');
    }

    if (info.permissions.admin !== true) {
      throw new PermissionsError('Must be admin to enable conjure');
    }

    // validate hook is not already set
    githubClient.org(orgName).repo(repoName).hooks(async (err, data) => {
      if (err) {
        throw err;
      }

      if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          // if we encounter the hook we are looking for, upsert and respond
          if (data[i].config && data[i].config.url === newHookPath) {
            await upsertWatchedRepoRecord(req);
            return res.send({
              success: true
            });
          }
        }
      }

      // create new hook
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
      }, async err => {
        if (err) {
          console.log(err.body.errors);
          throw err;
        }

        // save our own record of the hook
        await upsertWatchedRepoRecord(req);

        res.send({
          success: true
        });
      });
    });
  });
});

async function upsertWatchedRepoRecord(req) {
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

  await DatabaseTable.upsert('watched_repo', {
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
  });
}

module.exports = route;
