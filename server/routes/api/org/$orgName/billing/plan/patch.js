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

  // finding original record=
  const originalRecordsResult = await query(`
    SELECT id FROM github_org_monthly_billing_plan
    WHERE deactivated IS NULL
    AND activated IS NOT NULL
    AND org_id = $1
    LIMIT 1
  `, [githubOrg.id])

  if (!originalRecordsResult.rows.length) {
    throw new NotFoundError('Org billing plan does not exist')
  }

  // does not set activated timestamp here
  await DatabaseTable.update('github_org_monthly_billing_plan', {
    monthly_billing_plan: monthlyBillingPlan
    updated: new Date()
  }, {
    id: originalRecordsResult.rows[0].id
  })

  res.send({})
})
