const Route = require('@conjurelabs/route');
const { ContentError, UnexpectedError } = require('@conjurelabs/err');

const route = new Route({
  requireAuthentication: true
});

/*
  Container status endpoint
 */
route.push(async (req, res) => {
  let containerIds = req.query.ids;

  // for now, not erroring, and just returning the first 200 rows
  // todo: pagination or another solution for the possibility of too many ids?
  containerIds = containerIds.slice(0, 200);

  if (!Array.isArray(containerIds)) {
    throw new ContentError('Expecting array of `id`s');
  }

  const { query } = require('@conjurelabs/db');
  
  const sqlArgs = [];
  const sqlWheres = [];

  // records associated to user
  sqlWheres.push(`wr.service_repo_id IN ( SELECT service_repo_id FROM account_repo WHERE account = $${sqlArgs.length + 1} )`);
  sqlArgs.push(req.user.id);

  // ids checking within
  // todo: see if this breaks with too many container ids
  const idsInMunged = containerIds
    .map((_, i) => {
      return `$${i + 1 + sqlArgs.length}`;
    })
    .join(',');
  sqlWheres.push(`c.id IN (${idsInMunged})`);
  for (let i = 0; i < containerIds.length; i++) {
    sqlArgs.push(containerIds[i]);
  }

  // pulling 1 more than needed, to check if there are more results
  const result = query(`
    SELECT
      id, is_active, active_start
    FROM container c
    INNER JOIN watched_repo wr ON c.repo = wr.id
    WHERE ${sqlWheres.join(`
      AND
    `)}
    ORDER BY c.added DESC
  `, sqlArgs);

  // should not happen
  if (!Array.isArray(result.rows)) {
    throw new UnexpectedError('No rows returned');
  }

  const statuses = result.rows.reduce((dict, row) => {
    // todo: add this logic to a class or module? it is used here and in the timeline get route
    dict[ row.id ] = row.is_active === true && !row.active_start ? 'Spinning Up' :
      row.is_active === true && row.active_start ? 'Running' :
      row.is_active === false ? 'Spun Down' :
      'Unknown'; // should not happen

    return dict;
  }, {});

  return res.send({
    statuses
  });
});

module.exports = route;
