const Route = require('conjure-core/classes/Route');
const passport = require('passport');

const route = new Route();

/*
  Auth initiation
 */
route.push(passport.authenticate('github'));

module.exports = route;
