const Route = require('conjure-core/classes/Route');

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push(async (req, res) => {
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  
  const watchedRepo = new DatabaseTable('watched_repo');
  const watchedRepos = watchedRepo.select({
    account: req.user.id
  });

  const accountRepo = new DatabaseTable('account_repo');
  const accountRepos = await watchedRepo.select({
    account: req.user.id
  });

  const watchedReposServiceIds = (await watchedRepos).map(repo => repo.service_repo_id);

  const notWatchedRepos = accountRepos.filter(repo => !watchedReposServiceIds.includes(repo.service_repo_id));

  const UniqueArray = require('conjure-core/classes/Array/UniqueArray');
  let uniqueWatchedOrgs = new UniqueArray('org');
  for (let i = 0; i < watchedRepos; i++) {
    uniqueWatchedOrgs.push(watchedRepos[i]);
  }
  uniqueWatchedOrgs = uniqueWatchedOrgs.map(repo => repo.org);

  res.send({
    watched: {
      orgs: uniqueWatchedOrgs,
      repos: watchedRepos.map(repo => minialRepo(repo))
    },
    additional: {
      orgs: !!notWatchedRepos.find(repo => !uniqueWatchedOrgs.includes(repo.org)),
      // repos, by already watched org ids
      reposByOrg: uniqueWatchedOrgs.reduce((indicators, org) => {
        indicators[org] = !!notWatchedRepos.find(repo => !watchedReposServiceIds.includes(repo.service_repo_id));
        return indicators;
      }, {})
    }
  });
});

// todo: make a resusable database util that knows how to strip records before sending to client
function minialRepo(repo => ({
  org: repo.org,
  name: repo.name,
  pirvate: repo.private,
  disabled: repo.disabled
}))l

module.exports = route;
