const Route = require('conjure-core/classes/Route');
const { NotFoundError, UnexpectedError } = require('conjure-core/modules/err');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  const database = require('conjure-core/modules/database');

  // unset any existing plans for the user
  const matchingPlans = await database.query(`
    SELECT monthly_billing_plan
    FROM account_monthly_billing_plan
    WHERE deactivated IS NULL
    AND activated IS NOT NULL
    AND account = $1
  `, [req.user.id]);

  // possible if user has no active plan set
  if (!Array.isArray(matchingPlans.rows)) {
    throw new NotFoundError('No billing plan found');
  }

  // if this happens, then we have conflicting data in the table
  if (matchingPlans.rows.length > 1) {
    throw new UnexpectedError('Multiple user billing plans found');
  }

  // get full row
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const monthlyBillingPlan = new DatabaseTable('monthly_billing_plan');

  // not checking for active billing plan, in case user is somehow grandfathered in
  // migrating users to new plans should be handled with proper messaging, etc
  const rows = await monthlyBillingPlan.select({
    id: matchingPlans[0].monthly_billing_plan
  });

  // at this point, this should not happen
  if (rows.length !== 1) {
    throw new UnexpectedError('Mismatch between user billing row set, and billing lookup');
  }

  // returning a mashup of the two rows, with what is relevant to the user
  return res.send({
    cost: rows[0].cost,
    containerLimit: rows[0].parallel_container_limit,
    added: matchingPlans[0].added,
    activated: matchingPlans[0].activated
  });
});

module.exports = route;
