const Route = require('conjure-core/classes/Route');
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;
const ContentError = require('conjure-core/modules/err').ContentError;

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push((req, res, next) => {
  const stripeCardId = req.params.cardStripeId;

  // pulling various record in parallel, to improve speed
  const parallel = {};

  // pull stripe customer instance, based on account record
  parallel.stripeCustomer = callback => {
    pullStripeCustomerInstance(req, callback);
  };

  // pull account card rows
  parallel.accountCards = callback => {
    const DatabaseTable = require('conjure-core/classes/DatabaseTable');
    const accountCard = new DatabaseTable('account_card');

    if (!req.user) {
      return next(new UnexpectedError('No req.user available'));
    }

    accountCard.select({
      account: req.user.id
    }, (err, rows) => {
      callback(err, rows);
    });
  };

  const async = require('async');
  async.parallel(parallel, (err, records) => {
    if (err) {
      return next(err);
    }

    // verify user even has this card
    const cardMatches = records.accountCards.filter(card => {
      return card.stripe_id === stripeCardId;
    });

    if (!cardMatches.length) {
      return next(new ContentError('This account does not have the corresponding card on record'));
    } else if (cardMatches.length > 1) {
      // this should not happen
      // todo: maybe allow this and clear _all_ of these records at once?
      return next(new ContentError('There are more than one cards on file with the same id'));
    }

    const cardMatch = cardMatches[0];
    const series = [];

    // first delete our own reference to it
    series.push(callback => {
      cardMatch.delete(callback);
    });

    // now delete the stripe id
    // todo: have a worker routinely clean up stipe cards that have no association in our db, in case our delete works and this call does not?
    series.push(callback => {
      const Card = require('conjure-core/classes/Stripe/Card');
      Card.delete(records.stripeCustomer, stripeCardId, callback);
    });

    async.series(series, err => {
      if (err) {
        return next(err);
      }

      res.send({});
    });
  });
});

module.exports = route;

function pullStripeCustomerInstance(req, callback) {
  const waterfall = [];

  // getting full user account record
  waterfall.push(callback => {
    const DatabaseTable = require('conjure-core/classes/DatabaseTable');
    const account = new DatabaseTable('account');

    account.select({
      id: req.user.id
    }, (err, rows) => {
      if (err) {
        return callback(err);
      }

      // should not be possible
      if (!rows.length) {
        return callback(new UnexpectedError('Could not find account record'));
      }

      // should not be possible
      if (rows.length > 1) {
        return callback(new UnexpectedError('Expected a single row for account record, received multiple'));
      }

      callback(null, rows[0]);
    });
  });

  // getting/creating stripe customer record
  waterfall.push((account, callback) => {
    // if no account stripe_id, then error, since we expect it
    if (typeof account.stripe_id !== 'string' || !account.stripe_id) {
      return callback(new ContentError('Account is not associated to any Stripe records'));
    }

    const Customer = require('conjure-core/classes/Stripe/Customer');

    Customer.retrieve(req.user.id, account.stripe_id, (err, customerRecord) => {
      callback(err, customerRecord);
    });
  });

  const asyncWaterfall = require('conjure-core/modules/async/waterfall');
  asyncWaterfall(waterfall, callback);
}
