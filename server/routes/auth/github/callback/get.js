const config = require('conjure-core/modules/config');
const Route = require('conjure-core/classes/Route');
const passport = require('passport');

const route = new Route();

/*
  Auth callback
 */
route.push(passport.authenticate('github', {
  failureRedirect: config.app.web.url
}));

route.push(async (req, res) => {
  if (req.cookies && typeof req.cookies['conjure-auth-redirection'] === 'string') {
    res.clearCookie('conjure-auth-redirection');
    res.redirect(302, req.cookies['conjure-auth-redirection']);
    return;
  }

  res.redirect(302, config.app.web.url);
});

module.exports = route;
