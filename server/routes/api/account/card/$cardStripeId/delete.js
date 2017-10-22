const Route = require('conjure-core/classes/Route');
const { UnexpectedError, ContentError } = require('conjure-core/modules/err');

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push(async (req, res, next) => {
  const stripeCardId = req.params.cardStripeId;

  const stripeCustomer = pullStripeCustomerInstance(req, callback);

  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const accountCard = new DatabaseTable('account_card');

  if (!req.user) {
    throw new UnexpectedError('No req.user available');
  }

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
  const series = [];

  // first delete our own reference to it
  await cardMatch.delete();

  // now delete the stripe id
  // todo: have a worker routinely clean up stipe cards that have no association in our db, in case our delete works and this call does not?
  const Card = require('conjure-core/classes/Stripe/Card');
  await Card.delete(await stripeCustomer, stripeCardId);

  res.send({});
});

module.exports = route;

async function pullStripeCustomerInstance(req) {
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const account = new DatabaseTable('account');

  const accountRows = await account.select({
    id: req.user.id
  });

  // should not be possible
  if (!rows.length) {
    throw new UnexpectedError('Could not find account record');
  }

  // should not be possible
  if (rows.length > 1) {
    throw new UnexpectedError('Expected a single row for account record, received multiple');
  }

  const account = accountRows[0];

  // if no account stripe_id, then error, since we expect it
  if (typeof account.stripe_id !== 'string' || !account.stripe_id) {
    throw new ContentError('Account is not associated to any Stripe records');
  }

  const Customer = require('conjure-core/classes/Stripe/Customer');

  return await Customer.retrieve(req.user.id, account.stripe_id);
}
