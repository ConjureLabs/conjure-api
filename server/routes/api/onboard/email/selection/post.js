const Route = require('@conjurelabs/route')
const { ContentError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { email } = req.body

  if (typeof email !== 'string' || !email.trim()) {
    throw new ContentError('Payload missing or in an unexpected format')
  }

  const { DatabaseTable } = require('@conjurelabs/db')
  await DatabaseTable.update('account', {
    email: email.trim()
  }, {
    id: req.user.id
  })

  // all good
  res.send({
    success: true
  })
})

module.exports = route
