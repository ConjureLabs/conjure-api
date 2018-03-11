const Route = require('@conjurelabs/route');
const passport = require('passport');

const route = new Route();

/*
  Auth initiation
 */
route.push(async (req, res) => {
  if (req.body && typeof req.body.redirection === 'string') {
    res.cookie('conjure-auth-redirection', req.body.redirection, {
      maxAge: 120000, // 2 minutes
      httpOnly: true
    });
  }
});

route.push(passport.authenticate('github'));

module.exports = route;
