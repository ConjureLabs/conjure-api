const Route = require('conjure-core/classes/Route');
const { UnexpectedError, ContentError } = require('conjure-core/modules/err');

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push(async (req, res) => {
  // pull stripe customer instance, based on account record
  const Customer = require('conjure-core/classes/Stripe/Customer');
  const stripeCustomer = await Customer.getRecordFromReq(req);

  // pull account card rows
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const accountCard = new DatabaseTable('account_card');
  const accountCards = await accountCard.select({
    account: req.user.id
  });

  // pulling full card details
  const cards = accountCards
    .filter(accountCard => {
      // removing any account card records that are not associated to a stripe record
      return typeof accountCard.stripe_id === 'string' && accountCard.stripe_id;
    })
    .map(async accountCard => {
      const Card = require('conjure-core/classes/Stripe/Card');
      return await Card.retrieve(stripeCustomer, accountCard.stripe_id);
    });

  return res.send({
    cards
  });
});

module.exports = route;
