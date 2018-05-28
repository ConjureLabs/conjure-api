const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: false
})

route.push((req, res, next) => {
  const val = conjure.cookies['conjure-debug-cookie']
  if (val === undefined) {
    console.log('\n\tCookie missing\n')
  } else {
    console.log(`\n\tCookie value is ${val}\n`)
  }
  next()
})

module.exports = route
