const Route = require('@conjurelabs/route')
const { ContentError, PermissionsError } = require('@conjurelabs/err')
const config = require('conjure-core/modules/config')
const log = require('conjure-core/modules/log')('github watch repo')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { DatabaseTable } = require('@conjurelabs/db')
  const { org, name } = req.body

  if (!org || !name) {
    throw new ContentError('Request body missing required fields')
  }

  // ensure user has correct access to this repo
  const apiRepos = require('../../repos/get.js').call
  const { reposByOrg } = await apiRepos(req, {
    org,
    name
  })

  if (!reposByOrg[org] || !reposByOrg[org].length) {
    throw new PermissionsError('User does not have access to this repo')
  }

  await DatabaseTable.update('watchedRepo', {
    org,
    name,
    disabled: true,
    updated: new Date()
  })

  res.send({
    success: true
  })
})

module.exports = route
