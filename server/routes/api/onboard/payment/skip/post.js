const { UnexpectedError, ContentError } = require('@conjurelabs/err')
const Route = require('@conjurelabs/route')
const config = require('conjure-core/modules/config')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res, next) => {
  if (config.stripe.enabled === true) {
    return next()
  }

  // mark account as onboarded
  const { DatabaseTable } = require('@conjurelabs/db')
  const account = new DatabaseTable('account')
  await account.update({
    onboarded: true,
    updated: new Date()
  }, {
    id: req.user.id
  })

  res.clearCookie('onboard-repos')

  res.cookie('conjure-added-payment', '' + Date.now())

  res.send({})
})

module.exports = route
