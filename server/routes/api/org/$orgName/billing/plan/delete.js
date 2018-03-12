const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { query } = require('@conjurelabs/db')

  // must get github org id, based on name
  const apiGetGitHubOrgInfo = require('../../get.js').call
  const githubOrg = await apiGetGitHubOrgInfo(req)

  // unset any existing plans for the org
  await query(`
    UPDATE github_org_monthly_billing_plan
    SET deactivated = NOW()
    WHERE deactivated IS NULL
    AND activated IS NOT NULL
    AND org_id = $1
  `, [githubOrg.id])

  return res.send({})
})
