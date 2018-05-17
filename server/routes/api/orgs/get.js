const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const apiGetRepos = require('../repos').call
  const reposByOrg = await apiGetRepos(req)

  res.send({
    orgs: Object.keys(reposByOrg)
  })
})

module.exports = route
