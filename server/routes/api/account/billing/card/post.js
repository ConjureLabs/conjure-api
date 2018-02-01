const Route = require('conjure-core/classes/Route');
const { UnexpectedError } = require('err');

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

// todo: verify card does not already exist in our system

route.push(async (req, res) => {
  const DatabaseTable = require('db/table');
  const cardData = req.body.card;
  const addressData = req.body.address;

  // getting full user account record
  const account = new DatabaseTable('account');

  const accountRows = await account.select({
    id: req.user.id
  });

  // should not be possible
  if (!accountRows.length) {
    throw new UnexpectedError('Could not find account record');
  }

  // should not be possible
  if (accountRows.length > 1) {
    throw new UnexpectedError('Expected a single row for account record, received multiple');
  }

  const accountRecord = accountRows[0];

  // getting/creating stripe customer record
  const Customer = require('conjure-core/classes/Stripe/Customer');

  // if account has a stripe customer record, get it and continue
  const customer = accountRecord.stripe_id ? await Customer.retrieve(req.user.id, accountRecord.stripe_id) : await new Customer(req.user.id, {
    email: account.email,
    name: account.name
  }).save();

  // store id for stripe customer record, on account row
  accountRecord.stripe_id = customer.id;
  accountRecord.updated = new Date();
  await accountRecord.save();

  // add credit card
  const Card = require('conjure-core/classes/Stripe/Card');

  const creditCard = new Card(customer, {
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
  }, req.body);
  await creditCard.save();

  await DatabaseTable.insert('account_card', {
    account: accountRecord.id,
    stripe_id: creditCard.id,
    added: new Date()
  });

  return res.send({});
});

module.exports = route;
