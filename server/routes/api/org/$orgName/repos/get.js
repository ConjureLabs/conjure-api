const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const apiGetAccountGitHub = require('../github/get.js').call
  const apiGetRepos = require('../../../repos/get.js').call

  const gitHubAccount = (await apiGetAccountGitHub(req)).account
  const repos = await apiGetRepos(req, {
    org: req.params.orgName
  })

  res.send(repos)
})

module.exports = route
