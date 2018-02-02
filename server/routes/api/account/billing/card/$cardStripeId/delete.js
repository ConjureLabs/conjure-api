const Route = require('route');
const { UnexpectedError, ContentError } = require('err');

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push(async (req, res) => {
  const stripeCardId = req.params.cardStripeId;

  const Customer = require('conjure-core/classes/Stripe/Customer');
  const stripeCustomer = await Customer.getRecordFromReq(req);

  const DatabaseTable = require('db/table');
  const accountCard = new DatabaseTable('account_card');

  const accountCards = await accountCard.select({
    account: req.user.id
  });

  // verify user even has this card
  const cardMatches = accountCards.filter(card => {
    return card.stripe_id === stripeCardId;
  });

  if (!cardMatches.length) {
    throw new ContentError('This account does not have the corresponding card on record');
  } else if (cardMatches.length > 1) {
    // this should not happen
    // todo: maybe allow this and clear _all_ of these records at once?
    throw new ContentError('There are more than one cards on file with the same id');
  }

  const cardMatch = cardMatches[0];

  // first delete our own reference to it
  await cardMatch.delete();

  // now delete the stripe id
  // todo: have a worker routinely clean up stipe cards that have no association in our db, in case our delete works and this call does not?
  const Card = require('conjure-core/classes/Stripe/Card');
  await Card.delete(await stripeCustomer, stripeCardId);

  return res.send({});
});

module.exports = route;
