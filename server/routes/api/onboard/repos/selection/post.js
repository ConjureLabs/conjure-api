const Route = require('@conjurelabs/route')
const { ContentError, UnexpectedError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  if (!Array.isArray(req.body)) {
    throw new ContentError('Payload missing or in an unexpected format')
  }

  res.cookieSecure('onboard-repos', JSON.stringify(req.body))

  // all good
  res.send({
    success: true
  })
})

module.exports = route
