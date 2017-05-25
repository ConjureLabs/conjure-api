const Route = require('conjure-core/classes/Route');

const route = new Route({
  blacklistedEnv: {
    NODE_ENV: ['production']
  }
});

/*
  dev endpoint to debug user object
 */
route.push((req, res, next) => {
  console.log('authed', req.isAuthenticated());
  console.log('user', req.user);
  next();
});

module.exports = route;
