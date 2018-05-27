const Route = require('@conjurelabs/route')
const config = require('conjure-core/modules/config')
const log = require('conjure-core/modules/log')('github watch repo')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { DatabaseTable } = require('@conjurelabs/db')

  const {
    service,
    url,
    orgName,
    orgId,
    name,
    githubId,
    isPrivate,
    vm
  } = req.body

  await DatabaseTable.upsert('watchedRepo', {
    account: req.user.id,
    service,
    serviceRepoId: githubId,
    url,
    org: orgName,
    orgId,
    name,
    vm,
    private: isPrivate,
    disabled: false,
    added: new Date()
  }, {
    updated: new Date()
  }, {
    service,
    serviceRepoId: githubId
  })

  res.send({
    success: true
  })
})

module.exports = route
