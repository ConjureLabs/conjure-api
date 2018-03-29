const Route = require('@conjurelabs/route')
const { ContentError, UnexpectedError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  req.body.orgId = req.cookies['conjure-onboard-orgs'].value
  req.body.orgName = req.cookies['conjure-onboard-orgs'].label
  req.body.activate = false // activate upon repos selection
  const apiAccountBillingPlanCreation = require('../../../account/billing/plan/put.js').call
  const result = await apiAccountBillingPlanCreation(req, req.body)

  // planId appended by api endpoint used
  const { planId } = req

  // appending plan id cookie so that we can activate it later
  res.cookie('conjure-onboard-plan', planId, {
    maxAge: 259200000, // 3 days
    httpOnly: true
  })

  res.send(result)
})

module.exports = route
