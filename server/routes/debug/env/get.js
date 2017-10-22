const Route = require('conjure-core/classes/Route');

const route = new Route({
  blacklistedEnv: {
    NODE_ENV: ['production']
  }
});

/*
  dev endpoint to debug env vars
 */
route.push(async () => {
  console.log('env', process.env);
});

module.exports = route;
