const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const { query } = require('@conjurelabs/db')

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
      INNER JOIN watched_repo wr
        ON ar.service_repo_id = wr.service_repo_id
      WHERE ar.account = $1
      AND wr.disabled IS FALSE
    `, [req.user.id])
  ).rows

  const watchedRepos = accountRepos.filter(repo => repo.watching === true)
  const watchedOrgs = watchedRepos
    .map(repo => repo.org)
    .reduce((unique, org) => {
      if (!unique.includes(org)) {
        unique.push(org)
      }
      return unique
    }, [])

  res.send(watchedOrgs)
})

module.exports = route
