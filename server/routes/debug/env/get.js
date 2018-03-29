const Route = require('@conjurelabs/route')

const route = new Route({
  blacklistedEnv: {
    NODE_ENV: ['production']
  }
})

/*
  dev endpoint to debug env vars
 */
route.push(async (req, res, next) => {
  console.log('env', process.env)
  next()
})

module.exports = route
