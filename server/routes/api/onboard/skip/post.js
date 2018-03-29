const Route = require('@conjurelabs/route')
const { NotFoundError, UnexpectedError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const DatabaseTable = require('@conjurelabs/db/table')
  const account = new DatabaseTable('account')

  const rows = await account.select({
    id: req.user.id
  })

  // record does not exist in our db - should not happen
  if (!rows.length) {
    throw new NotFoundError('Account not found')
  }

  // checking if user should be able to do this
  if (rows[0].onboarded === true) {
    throw new UnexpectedError('Account already onboarded')
  }

  rows[0].onboarded = true
  rows[0].updated = new Date()
  await rows[0].save()

  res.send({})
})

module.exports = route
