const Route = require('conjure-core/classes/Route');
const passport = require('passport');

const route = new Route();

/*
  Auth initiation
 */
route.push((req, res, next) => {
  if (req.body && typeof req.body.redirection === 'string') {
    res.cookie('conjure-auth-redirection', req.body.redirection, {
      maxAge: 120000, // 2 minutes
      httpOnly: true
    });
  }

  next();
});

route.push(passport.authenticate('github'));

module.exports = route;
