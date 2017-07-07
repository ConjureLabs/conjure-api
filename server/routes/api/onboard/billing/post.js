const Route = require('conjure-core/classes/Route');
const ContentError = require('conjure-core/modules/err').ContentError;

const route = new Route();

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
  const flow = [];

  // getting full user account record
  flow.push(callback => {
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
  flow.push((account, callback) => {
    const Customer = require('conjure-core/classes/Stripe/Customer');

    // if account has a stripe customer record, get it and continue
    if (account.stripe_id) {
      Customer.retrieve(req.user.id, account.stripe_id, (err, customerRecord) => {
        callback(err, account, customerRecord);
      });
      return;
    }

    // if existing customer record does not exist, then we have to create one
    new Customer(req.user.id, {
      email: account.email,
      name: account.name
    }).save((err, customerRecord) => {
      callback(err, account, customerRecord);
    });
  });

  // add credit card
  flow.push((account, customer, callback) => {
    const Card = require('conjure-core/classes/Stripe/Card');
/*
if (data.id) {
      this.id = data.id;
    }

    this.cvc = data.cvc;
    this.name = data.name;
    this.number = data.number;

    const expiration = data.expiration || {};
    this.expiration = {
      month: expiration.month,
      year: expiration.year
    };

    const address = data.address || {};
    this.address = {
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      zip: address.zip,
      country: address.country
    };


    if (rawData) {
      this.rawData = rawData;
    }

 */
    new Card(customer, {

    }).save()
  });
});

module.exports = route;
