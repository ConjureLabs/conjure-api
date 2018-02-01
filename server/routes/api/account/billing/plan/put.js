const Route = require('conjure-core/classes/Route');
const { ContentError, UnexpectedError } = require('err');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  const { containerLimit } = req.body;

  if (!containerLimit || isNaN(containerLimit)) {
    throw new ContentError('Payload missing or in an unexpected format');
  }

  const database = require('conjure-core/modules/database');

  const matchingPlans = await database.query(`
    SELECT *
    FROM monthly_billing_plan
    WHERE parallel_container_limit = $1
    AND activated IS NOT NULL
    AND deactivated IS NULL
  `, [containerLimit]);

  // should not happen
  if (!Array.isArray(matchingPlans.rows)) {
    throw new UnexpectedError(`No matching plans found (for ${containerLimit} container limit)`);
  }

  // if this happens, then we have conflicting data in the table
  if (matchingPlans.rows.length > 1) {
    throw new UnexpectedError('Multiple matching plans found');
  }

  const plan = matchingPlans.rows[0];

  // unset any existing plans for the user
  await database.query(`
    UPDATE account_monthly_billing_plan
    SET deactivated = NOW()
    WHERE deactivated IS NULL
    AND activated IS NOT NULL
    AND account = $1
  `, [req.user.id]);

  // set new pricing plan for the user
  await database.query(`
    INSERT INTO account_monthly_billing_plan(account, monthly_billing_plan, added, activated)
    VALUES($1, $2, NOW(), NOW())
  `, [req.user.id, plan.id]);

  return res.send({});
});

module.exports = route;
