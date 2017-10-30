const Route = require('conjure-core/classes/Route');

const route = new Route({
  blacklistedEnv: {
    NODE_ENV: ['production']
  }
});

/*
  dev endpoint to debug async await routes, to make sure they work
 */
route.push((req, res, next) => {
  console.log('HIT ! 111');
  next();
});

route.push(async (req, res) => {
  console.log('HIT ! 222');
  return null;
});

route.push((req, res, next) => {
  console.log('HIT ! 333');
  next();
});

module.exports = route;