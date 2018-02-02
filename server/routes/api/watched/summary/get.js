const Route = require('route');

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push(async (req, res) => {
  const { query } = require('db');

  // getting all repo records user has access to
  const accountRepos = (
    await query(`
      SELECT
        ar.*,
        CASE
          WHEN wr.id IS NULL THEN false
          ELSE true
        END watching
      FROM account_repo ar
      LEFT JOIN watched_repo wr
        ON ar.service_repo_id = wr.service_repo_id
      WHERE ar.account = $1
    `, [req.user.id])
  ).rows;

  const watchedRepos = accountRepos.filter(repo => repo.watching === true);
  const watchedOrgs = watchedRepos
    .map(repo => repo.org)
    .reduce((unique, org) => {
      if (!unique.includes(org)) {
        unique.push(org);
      }
      return unique;
    }, []);

  const baseWatchedRepos = watchedOrgs.reduce((base, org) => {
    base[org] = false;
    return base;
  }, {});
  const notWatchedReposByOrg = accountRepos
    .filter(repo => repo.watching === false)
    .reduce((byOrg, repo) => {
      byOrg[ repo.org ] = true;
      return byOrg;
    }, baseWatchedRepos);

  const haveAdditionalOrgs = Object.keys(notWatchedReposByOrg).length > watchedOrgs.length;

  return res.send({
    watched: {
      orgs: watchedOrgs,
      repos: watchedRepos.map(repo => minialRepo(repo))
    },
    additional: {
      orgs: haveAdditionalOrgs,
      reposByOrg: notWatchedReposByOrg
    }
  });
});

// todo: make a resusable database util that knows how to strip records before sending to client
function minialRepo(repo) {
  return {
    org: repo.org,
    name: repo.name,
    private: repo.private,
    disabled: repo.disabled
  };
}

module.exports = route;
