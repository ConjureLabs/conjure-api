const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { query } = require('@conjurelabs/db')

  // unset any existing plans for the user
  await query(`
    UPDATE account_monthly_billing_plan
    SET deactivated = NOW()
    WHERE deactivated IS NULL
    AND activated IS NOT NULL
    AND account = $1
  `, [req.user.id])

  return res.send({})
})

module.exports = route
