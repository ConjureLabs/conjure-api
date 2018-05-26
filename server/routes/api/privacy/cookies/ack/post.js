const Route = require('@conjurelabs/route')
const { ContentError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: false
})

route.push(async (req, res) => {
  // cookie user so they don't see the gdpr cookies privacy messaging anymore
  res.cookie('conjure-cookies', 'ack')

  // all good
  res.send({
    success: true
  })
})

module.exports = route
