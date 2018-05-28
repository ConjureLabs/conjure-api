const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: false
})

route.push((req, res, next) => {
  const val = Date.now().toString()
  res.cookie('conjure-debug-cookie', val)
  console.log(`\n\tCookie should be set to ${val}\n`)
  next()
})

module.exports = route
