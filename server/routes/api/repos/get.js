const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const { DatabaseTable } = require('@conjurelabs/db')
  const { access, org } = req.query

  const where = {
    account: req.user.id
  }
  if (access) {
    where.accessRights = access
  }
  if (org) {
    where.org = org
  }
  const repos = await DatabaseTable.select('accountRepo', where)

  const reposByOrg = repos.reduce((byOrg, repo) => {
    const orgRepos = byOrg[ repo.org ]

    if (!Array.isArray(orgRepos)) {
      byOrg[ repo.org ] = [ repo ]
    } else {
      orgRepos.push(repo)
    }

    return byOrg
  }, {})

  const sortInsensitive = require('@conjurelabs/utils/Array/sort-insensitive')
  reposByOrg.map(repos => sortInsensitive(repos, 'name'))

  // todo: stop sending by org all the time - it's an overhead most of the time
  res.send({
    reposByOrg
  })
})

module.exports = route
