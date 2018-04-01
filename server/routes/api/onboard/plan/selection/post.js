const Route = require('@conjurelabs/route')
const { ContentError, UnexpectedError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const orgName = req.cookies['conjure-onboard-orgs'].label

  req.body.orgId = req.cookies['conjure-onboard-orgs'].value
  req.body.orgName = orgName
  req.body.activate = false // activate upon repos selection

  const apiAccountBillingPlanCreation = require('../../../org/$orgName/billing/plan/put.js').call
  const billingRecord = await apiAccountBillingPlanCreation(req, req.body, {
    orgName
  })

  // appending plan id cookie so that we can activate it later
  res.cookie('conjure-onboard-plan-billing', billingRecord.id, {
    maxAge: 259200000, // 3 days
    httpOnly: true
  })

  res.send(result)
})

module.exports = route
