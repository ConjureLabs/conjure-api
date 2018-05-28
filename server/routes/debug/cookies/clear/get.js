const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: false
})

route.push((req, res, next) => {
  res.clearCookie('conjure-debug-cookie')
  console.log(`\n\tCookie cleared\n`)
  next()
})

module.exports = route
