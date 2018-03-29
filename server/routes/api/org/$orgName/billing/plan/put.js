const Route = require('@conjurelabs/route')
const { NotFoundError, ContentError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { monthlyBillingPlan } = req.body.monthlyBillingPlan

  if (!monthlyBillingPlan || isNaN(monthlyBillingPlan)) {
    throw new ContentError('Payload missing or in an unexpected format')
  }

  const { query } = require('@conjurelabs/db')
  const DatabaseTable = require('@conjurelabs/db/table')

  // must get github org id, based on name
  const apiGetGitHubOrgInfo = require('../../get.js').call
  const githubOrg = await apiGetGitHubOrgInfo(req)

  if (!githubOrg.id) {
    throw new NotFoundError('No GitHub org id found')
  }

  const billingPlanResult = await query(`
    SELECT *
    FROM monthly_billing_plan
    WHERE id = $1
    AND activated IS NOT NULL
    AND deactivated IS NULL
    LIMIT 1
  `)
  if (!billingPlanResult.rows.length) {
    throw new NotFoundError('No associated billing plan found')
  }

  // does not set activated timestamp here
  const records = await DatabaseTable.insert('github_org_monthly_billing_plan', {
    org: req.params.orgName,
    orgId: githubOrg.id,
    account: req.user.id,
    monthly_billing_plan: monthlyBillingPlan,
    added: new Date()
  })

  res.send(records[0])
})

module.exports = route
