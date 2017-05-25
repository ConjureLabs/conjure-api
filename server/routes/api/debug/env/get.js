const Route = require('conjure-core/classes/Route');

const route = new Route({
  blacklistedEnv: {
    NODE_ENV: ['production']
  }
});

/*
  dev endpoint to debug env vars
 */
route.push((req, res, next) => {
  console.log('env', process.env);
  next();
});

module.exports = route;
