const config = require('conjure-core/modules/config');
const Route = require('conjure-core/classes/Route');
const passport = require('passport');

const route = new Route();

/*
  Auth callback
 */
route.push(passport.authenticate('github', {
  failureRedirect: config.app.web.url,
  successRedirect: config.app.web.url
}));

module.exports = route;
