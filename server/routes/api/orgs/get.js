const Route = require('conjure-core/classes/Route');

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push(async (req, res, next) => {
  const apiGetAccountGitHub = require('../account/github/get.js').call;
  const githubAccount = (await apiGetAccountGitHub(req)).account;

  const github = require('octonode');
  const githubClient = github.client(githubAccount.access_token);

  // just for debub purposes
  // todo: move or remove this
  githubClient.limit((err, left, max, reset) => {
    if (err) {
      console.log(err);
    } else {
      console.log('left', left);
      console.log('max', max);
      console.log('reset', reset);
    }
  });

  const allOrgs = await promisifiedGitHubGet(githubClient);

  allOrgs.push({
    id: githubAccount.github_id,
    login: githubAccount.username
  });

  return res.send({
    orgs: allOrgs.map(org => {
      return {
        id: org.id,
        login: org.login
      };
    })
  });
});

// todo: something better than this
function promisifiedGitHubGet(githubClient) {
  return new Promise((resolve, reject) => {
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
        return reject(err);
      }
      resolve(body);
    });
  });
}

module.exports = route;
