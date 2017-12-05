const Route = require('conjure-core/classes/Route');
const { ContentError, PermissionsError } = require('conjure-core/modules/err');
const log = require('conjure-core/modules/log')('github watch repo');

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
  console.log({
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

/*
  todo: deal with maximum limit of webhook errors

  ```
  github watch repo -->  { resource: 'Hook',
    code: 'custom',
    message: 'The "push" event cannot have more than 20 hooks' }
  github watch repo -->  { resource: 'Hook',
    code: 'custom',
    message: 'The "pull_request" event cannot have more than 20 hooks' }
  Conjure -->  { [Error: Validation Failed]
    message: 'Validation Failed',
    statusCode: 422,
    headers: 
     { date: 'Tue, 05 Dec 2017 21:16:20 GMT',
       'content-type': 'application/json; charset=utf-8',
       'content-length': '327',
       connection: 'close',
       server: 'GitHub.com',
       status: '422 Unprocessable Entity',
       'x-ratelimit-limit': '5000',
       'x-ratelimit-remaining': '4996',
       'x-ratelimit-reset': '1512512179',
       'x-oauth-scopes': 'admin:org_hook, admin:public_key, repo, user:email, write:repo_hook',
       'x-accepted-oauth-scopes': 'admin:repo_hook, repo, write:repo_hook',
       'x-oauth-client-id': 'a06770f4b5625c046c1f',
       'x-github-media-type': 'github.v3; format=json',
       'access-control-expose-headers': 'ETag, Link, Retry-After, X-GitHub-OTP, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-OAuth-Scopes, X-Accepted-OAuth-Scopes, X-Poll-Interval',
       'access-control-allow-origin': '*',
       'content-security-policy': 'default-src \'none\'',
       'strict-transport-security': 'max-age=31536000; includeSubdomains; preload',
       'x-content-type-options': 'nosniff',
       'x-frame-options': 'deny',
       'x-xss-protection': '1; mode=block',
       'x-runtime-rack': '0.103458',
       'x-github-request-id': 'FD09:181D0:48ECFC:625662:5A270CA4' },
    body: 
     { message: 'Validation Failed',
       errors: [ [Object], [Object] ],
       documentation_url: 'https://developer.github.com/v3/repos/hooks/#create-a-hook' } }
    ```
 */
function promisifiedGitHubRepoHooks(client, orgName, repoName) {
  return new Promise((resolve, reject) => {
    client.org(orgName).repo(repoName).hooks((err, data) => {
      if (err) {
        if (err.body && Array.isArray(err.body.errors)) {
          err.body.errors.forEach(specificErr => {
            log.error(specificErr);
          });
        }
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
        if (err.body && Array.isArray(err.body.errors)) {
          err.body.errors.forEach(specificErr => {
            log.error(specificErr);
          });
        }
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
