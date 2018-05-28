const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const apiGetRepos = require('../../../repos/get.js').call

  const repos = await apiGetRepos(req, {
    org: req.params.orgName
  })

  res.send(repos)
})

module.exports = route
