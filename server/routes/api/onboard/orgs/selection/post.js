const Route = require('@conjurelabs/route')
const { ContentError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  if (!req.body.label || !req.body.value) {
    throw new ContentError('Payload missing or in an unexpected format')
  }

  // record for org payment is set at plan selection

  res.cookie('conjure-onboard-orgs', req.body, {
    maxAge: 259200000, // 3 days
    httpOnly: true
  })

  res.send({})
})

module.exports = route
