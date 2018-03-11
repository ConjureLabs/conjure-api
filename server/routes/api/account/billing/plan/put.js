const Route = require('@conjurelabs/route');
const { ContentError, UnexpectedError } = require('@conjurelabs/err');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  const { containerLimit, orgName, orgId } = req.body;
  const activate = req.body.activate === undefined ? true : req.boyd.activate;

  if (!containerLimit || isNaN(containerLimit)) {
    throw new ContentError('Payload missing or in an unexpected format');
  }

  const { query } = require('@conjurelabs/db');

  const matchingPlans = await query(`
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

  // unset any existing plans for the user/org
  // todo: verify user has access to do this...
  await query(`
    UPDATE github_org_monthly_billing_plan
    SET deactivated = NOW()
    WHERE deactivated IS NULL
    AND activated IS NOT NULL
    AND orgId = $1
  `, [orgId]);

  // set new pricing plan for the user/org
  const activateValue = activate === true ? 'NOW()' : 'NULL';
  await query(`
    INSERT INTO github_org_monthly_billing_plan(account, org, org_id, monthly_billing_plan, added, activated)
    VALUES($1, $2, $3, $4, NOW(), ${activateValue})
  `, [req.user.id, orgName, orgId, plan.id]);

  // used in onboarding
  req.planId = plan.id;

  return res.send({});
});

module.exports = route;
