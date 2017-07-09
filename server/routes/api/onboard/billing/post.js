const Route = require('conjure-core/classes/Route');
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;
const log = require('conjure-core/modules/log')('onboard billing');

const route = new Route({
  requireAuthentication: true
});

/*
{ card: { number: '42', name: 'asddf', mm: '3', yyyy: 2019, cvc: '42' },
  address: 
   { country: 'dz',
     zip: '42',
     state: 'AK',
     city: '42',
     addr1: 'asdf',
     addr2: '24' } }
 */

route.push((req, res, next) => {
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const cardData = req.body.card;
  const addressData = req.body.address;
  const waterfall = [];

  // getting full user account record
  waterfall.push(callback => {
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
    const Customer = require('conjure-core/classes/Stripe/Customer');

    // if account has a stripe customer record, get it and continue
    if (account.stripe_id) {
      console.log('RETRIEVE', req.user.id, account.stripe_id);
      Customer.retrieve(req.user.id, account.stripe_id, (err, customerRecord) => {
        callback(err, account, customerRecord);
      });
      return;
    }

    // if existing customer record does not exist, then we have to create one
    
    console.log('CREATE', req.user.id, {
      email: account.email,
      name: account.name
    });
    new Customer(req.user.id, {
      email: account.email,
      name: account.name
    }).save((err, customerRecord) => {
      if (err) {
        return callback(err);
      }

      // store id for stripe customer record, on account row
      account.stripe_id = customerRecord.id;
      account.save(err => {
        callback(err, account, customerRecord);
      });
    });
  });

  // add credit card
  waterfall.push((account, customer, callback) => {
    const Card = require('conjure-core/classes/Stripe/Card');

    new Card(customer, {
      cvc: cardData.cvc,
      name: cardData.name,
      number: cardData.number,
      expiration: {
        month: cardData.mm,
        year: cardData.yyyy
      },
      address: {
        line1: addressData.addr1,
        line2: addressData.addr2,
        city: addressData.city,
        state: addressData.state,
        zip: addressData.zip,
        country: addressData.country
      }
    }, req.body).save((err, cardRecord) => {
      if (err) {
        return callback(err);
      }

      DatabaseTable.insert('account_card', {
        account: account.id,
        stripe_id: cardRecord.id,
        added: new Date()
      }, err => {
        callback(err);
      });
    });
  });

  const asyncWaterfall = require('conjure-core/modules/async/waterfall');
  asyncWaterfall(waterfall, err => {
    if (err) {
      return next(err);
    }

    // all good
    res.send({});
  });
});

module.exports = route;
