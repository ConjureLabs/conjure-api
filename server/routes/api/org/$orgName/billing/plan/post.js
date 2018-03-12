const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const DatabaseTable = require('@conjurelabs/db/table')

  // must get github org id, based on name
  const apiGetGitHubOrgInfo = require('../../get.js').call
  const githubOrg = await apiGetGitHubOrgInfo(req)

  // does not set activated timestamp here
  const records = await DatabaseTable.insert('githubOrgMonthlyBillingPlan', {
    org: req.params.orgName,
    orgId: githubOrg.id,
    account: req.user.id,
    monthlyBillingPlan: req.body.monthlyBillingPlan,
    added: new Date()
  })

  return res.send(records[0])
})
