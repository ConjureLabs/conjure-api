const Route = require('@conjurelabs/route')
const { UnexpectedError, ContentError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  // pull stripe customer instance, based on account record
  const Customer = require('conjure-core/classes/Stripe/Customer')
  const stripeCustomer = await Customer.getRecordFromReq(req)

  // pull account card rows
  const DatabaseTable = require('@conjurelabs/db/table')
  const accountCard = new DatabaseTable('account_card')
  const accountCards = await accountCard.select({
    account: req.user.id
  })

  // pulling full card details
  const cards = await accountCards.filter(accountCard => {
    // removing any account card records that are not associated to a stripe record
    return typeof accountCard.stripe_id === 'string' && accountCard.stripe_id
  })
  const Card = require('conjure-core/classes/Stripe/Card')
  for (let i = 0; i < cards.length; i++) {
    cards[i] = await Card.retrieve(stripeCustomer, cards[i].stripe_id)
  }

  return res.send({
    cards
  })
})

module.exports = route
