const Route = require('@conjurelabs/route')
const { ContentError, UnexpectedError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  if (!Array.isArray(req.body)) {
    throw new ContentError('Payload missing or in an unexpected format')
  }

  const selections = req.body.slice() // slice to ensure native array
  res.cookieSecure('onboard-repos', selections)

  // all good
  res.send({})
})

module.exports = route
