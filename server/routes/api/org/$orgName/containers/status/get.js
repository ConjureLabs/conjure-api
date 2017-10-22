const Route = require('conjure-core/classes/Route');
const { ContentError, UnexpectedError } = require('conjure-core/modules/err');
const config = require('conjure-core/modules/config');

const route = new Route({
  requireAuthentication: true
});

const webConfig = config.app.web;

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

  const database = require('conjure-core/modules/database');

  const orgName = req.params.orgName;

  // todo: verify user has github access to this org
  
  const sqlArgs = [orgName];

  for (let i = 0; i < containerIds.length; i++) {
    sqlArgs.push(containerIds[i]);
  }

  const idsInMunged = containerIds
    .map((_, i) => {
      return `$${i + 2}`;
    })
    .join(',');

  // pulling 1 more than needed, to check if there are more results
  const result = await database.query(`
    SELECT
      id, is_active, active_start
    FROM container c
    WHERE repo IN (
      SELECT id FROM watched_repo WHERE org = $1
    )
    AND id IN (${idsInMunged})
    ORDER BY added DESC
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

  res.send({
    statuses
  });
});

module.exports = route;
