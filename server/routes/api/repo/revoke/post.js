const Route = require('@conjurelabs/route')
const { ContentError, PermissionsError } = require('@conjurelabs/err')
const config = require('conjure-core/modules/config')
const log = require('conjure-core/modules/log')('github watch repo')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { DatabaseTable } = require('@conjurelabs/db')
  const { orgName, repoName } = req.body

  if (!orgName || !repoName) {
    throw new ContentError('Request body missing required fields')
  }

  // ensure user has correct access to this repo
  const apiRepos = require('../../repos/get.js').call
  const repoByOrg = await apiRepos(req, {
    org: orgName,
    name: repoName
  })

  if (!repoByOrg[orgName] || !repoByOrg[orgName].length) {
    throw new PermissionsError('User does not have access to this repo')
  }

  await DatabaseTable.update('watchedRepo', {
    org: orgName,
    name: repoName,
    disabled: true,
    updated: new Date()
  })

  res.send({
    success: true
  })
})

module.exports = route
