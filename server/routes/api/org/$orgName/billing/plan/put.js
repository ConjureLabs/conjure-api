const Route = require('@conjurelabs/route')
const { NotFoundError, ContentError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { orgName } = req.params
  const { monthlyBillingPlan } = req.body

  if (!monthlyBillingPlan || isNaN(monthlyBillingPlan)) {
    throw new ContentError('Payload missing or in an unexpected format')
  }

  const { query, DatabaseTable } = require('@conjurelabs/db')

  // must get github org id, based on name
  const apiGetGitHubOrgInfo = require('../../get.js').call
  const githubOrg = await apiGetGitHubOrgInfo(req, null, {
    orgName
  })

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
  `, [monthlyBillingPlan])
  if (!billingPlanResult.rows.length) {
    throw new NotFoundError('No associated billing plan found')
  }

  // verify this is not a duplication
  const existingOrgPlans = await query(`
    SELECT id
    FROM github_org_monthly_billing_plan
    WHERE org_id = $1
    AND deactivated IS NULL
  `, [githubOrg.id])
  if (existingOrgPlans.rows.length) {
    // invalidate the old row
    await query(`
      UPDATE github_org_monthly_billing_plan
      SET deactivated = NOW()
      WHERE org_id = $1
      AND deactivated IS NULL
    `, [githubOrg.id])
  }

  // does not set activated timestamp here
  const records = await DatabaseTable.insert('githubOrgMonthlyBillingPlan', {
    org: orgName,
    orgId: githubOrg.id,
    account: req.user.id,
    monthlyBillingPlan,
    added: new Date()
  })

  res.send(records[0])
})

module.exports = route
