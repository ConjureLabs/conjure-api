const Route = require('@conjurelabs/route')
const { ContentError, PermissionsError } = require('@conjurelabs/err')
const log = require('conjure-core/modules/log')('github watch repo')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const config = require('conjure-core/modules/config')

  const {
    orgName,
    repoName
  } = req.body

  // save our own record of the hook
  await upsertWatchedRepoRecord(req)

  res.send({
    success: true
  })
})

async function upsertWatchedRepoRecord(req) {
  const { DatabaseTable } = require('@conjurelabs/db')

  const {
    service,
    url,
    orgName,
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
}

module.exports = route
