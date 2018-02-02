const Route = require('route');

const route = new Route({
  blacklistedEnv: {
    NODE_ENV: ['production']
  }
});

/*
  dev endpoint to debug user object
 */
route.push(async req => {
  console.log('authed', req.isAuthenticated());
  console.log('user', req.user);
});

module.exports = route;
