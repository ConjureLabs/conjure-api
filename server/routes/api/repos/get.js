const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const { DatabaseTable } = require('@conjurelabs/db')
  const { org, name } = req.query

  const where = {
    account: req.user.id
  }
  if (org) {
    where.org = org
  }
  if (name) {
    where.name = name
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
  for (const org in reposByOrg) {
    sortInsensitive(reposByOrg[org], 'name')
  }

  // todo: stop sending by org all the time - it's an overhead most of the time
  res.send({
    reposByOrg
  })
})

module.exports = route
