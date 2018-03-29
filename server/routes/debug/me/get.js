const Route = require('@conjurelabs/route')

const route = new Route({
  blacklistedEnv: {
    NODE_ENV: ['production']
  }
})

/*
  dev endpoint to debug user object
 */
route.push(async (req, res, next) => {
  console.log('authed', req.isAuthenticated())
  console.log('user', req.user)
  next()
})

module.exports = route
