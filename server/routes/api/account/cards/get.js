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

    // pulling full card details
    const retrieveCards = records.accountCards
      .filter(accountCard => {
        // removing any account card records that are not associated to a stripe record
        return typeof accountCard.stripe_id === 'string' && accountCard.stripe_id;
      })
      .map(accountCard => {
        return callback => {
          const Card = require('conjure-core/classes/Stripe/Card');
          Card.retrieve(records.stripeCustomer, accountCard.stripe_id, (err, card) => {
            callback(err, card);
          });
        };
      });

    async.parallel(retrieveCards, (err, cards) => {
      if (err) {
        return next(err);
      }

      res.send({
        cards
      });
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
