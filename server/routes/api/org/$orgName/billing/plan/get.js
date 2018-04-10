const Route = require('@conjurelabs/route')
const { NotFoundError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { orgName } = req.params

  const { query, DatabaseTable } = require('@conjurelabs/db')

  // must get github org id, based on name
  const apiGetGitHubOrgInfo = require('../../get.js').call
  const githubOrg = await apiGetGitHubOrgInfo(req, null, {
    orgName
  })

  // unset any existing plans for the org
  const orgPlanResult = await query(`
    SELECT * FROM github_org_monthly_billing_plan
    WHERE deactivated IS NULL
    AND activated IS NOT NULL
    AND org_id = $1
  `, [githubOrg.id])
  const orgPlan = result.rows[0]

  if (!orgPlan) {
    throw new NotFoundError('No billing plan found for org')
  }

  // getting plan info
  const matchingPlans = await DatabaseTable.select('monthlyBillingPlan', {
    id: orgPlan.monthlyBillingPlan
  })

  if (!matchingPlans.length) {
    throw new NotFoundError('No billing plan found')
  }

  res.send(matchingPlans[0])
})

module.exports = route
