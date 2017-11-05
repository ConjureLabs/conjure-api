const Route = require('conjure-core/classes/Route');
const { ContentError, PermissionsError } = require('conjure-core/modules/err');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  const config = require('conjure-core/modules/config');

  const {
    orgName,
    repoName
  } = req.body;

  const newHookPath = `${config.app.api.protocol}://${config.app.api.publicDomain}/hook/github/${orgName}/${repoName}`;

  // get github client
  const apiGetAccountGitHub = require('../../account/github/get.js').call;
  const githubAccount = (await apiGetAccountGitHub(req)).account;

  // prepare github api client
  const github = require('octonode');
  const githubClient = github.client(githubAccount.access_token);

  // validate permissions on repo
  const info = await promisifiedGitHubInfo(githubClient, orgName, repoName);

  if (!info || !info.permissions) {
    throw new ContentError('Unexpected payload');
  }

  if (info.permissions.admin !== true) {
    throw new PermissionsError('Must be admin to enable conjure');
  }

  // validate hook is not already set
  const hooks = await promisifiedGitHubRepoHooks(githubClient, orgName, repoName);

  if (Array.isArray(hooks)) {
    for (let i = 0; i < hooks.length; i++) {
      // if we encounter the hook we are looking for, upsert and respond
      if (hooks[i].config && hooks[i].config.url === newHookPath) {
        await upsertWatchedRepoRecord(req);
        return res.send({
          success: true
        });
      }
    }
  }

  // create new hook
  await promisifiedGitHubSetHook(githubClient, orgName, repoName, {
    name: 'web',
    active: true,
    events: ['push', 'pull_request'],
    config: {
      content_type: 'json',
      insecure_ssl: 1, // todo: config this - see https://developer.github.com/v3/repos/hooks/#create-a-hook
      secret: config.services.github.inboundWebhookScret,
      url: newHookPath
    }
  });

  // save our own record of the hook
  await upsertWatchedRepoRecord(req);

  return res.send({
    success: true
  });
});

// todo: something better
function promisifiedGitHubInfo(client, orgName, repoName) {
  return new Promise((resolve, reject) => {
    client.repo(`${orgName}/${repoName}`).info((err, info) => {
      if (err) {
        return reject(err);
      }
      resolve(info);
    });
  });
}

function promisifiedGitHubRepoHooks(client, orgName, repoName) {
  return new Promise((resolve, reject) => {
    client.org(orgName).repo(repoName).hooks((err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
}

function promisifiedGitHubSetHook(client, orgName, repoName, data) {
  return new Promise((resolve, reject) => {
    client.org(orgName).repo(repoName).hook(data, err => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

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
