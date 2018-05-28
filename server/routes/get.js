const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: false
})

route.push((req, res) => {
  res.send({
    conjure: 'is the best'
  })
})

module.exports = route
