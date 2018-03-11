const Route = require('@conjurelabs/route')
const { UnexpectedError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const DatabaseTable = require('@conjurelabs/db/table')
  const Account = new DatabaseTable('account')

  const rows = await Account.select({
    id: req.user.id
  })

  // should not be possible
  if (!rows.length) {
    throw new UnexpectedError('Could not find account record')
  }

  // should not be possible
  if (rows.length > 1) {
    throw new UnexpectedError('Expected a single row for account record, received multiple')
  }

  return res.send({
    account: rows[0]
  })
})

module.exports = route
