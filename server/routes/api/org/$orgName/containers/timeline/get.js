const Route = require('conjure-core/classes/Route');
const { ContentError, UnexpectedError } = require('conjure-core/modules/err');
const config = require('conjure-core/modules/config');

const route = new Route({
  requireAuthentication: true
});

const webConfig = config.app.web;

/*
  Container timeline
 */
route.push(async (req, res, next) => {
  const page = parseInt(req.query.page, 10); // required
  let rel = parseInt(req.query.rel, 10); // may be NaN, if page = 1

  const limit = 32; // todo: config this?

  if (isNaN(page) || page < 0) {
    throw new ContentError('Missing page number');
  } else if (page > 1 && isNaN(rel)) {
    throw new ContentError('Must pass `rel` if paging');
  }

  const database = require('conjure-core/modules/database');

  const orgName = req.params.orgName;

  // todo: verify user has github access to this org
  
  const sqlArgs = [orgName];

  // if using paging rel (relative row id that marks row 0) then we must page against that row
  let sqlWhereAddition = '';
  if (rel) {
    sqlWhereAddition = `AND c.id <= $2`;
    sqlArgs.push(rel);
  }

  // pulling 1 more than needed, to check if there are more results
  const result = await database.query(`
    SELECT
      c.*,
      wr.name repo_name,
      wr.private repo_private
    FROM container c
    INNER JOIN watched_repo wr ON c.repo = wr.id
    WHERE c.repo IN (
      SELECT id FROM watched_repo WHERE org = $1
    )
    ${sqlWhereAddition}
    ORDER BY added DESC
    LIMIT ${limit + 1}
    OFFSET ${page * limit}
  `, sqlArgs);

  // should not happen
  if (!Array.isArray(result.rows)) {
    throw new UnexpectedError('No rows returned');
  }

  const moreRows = result.rows.length > limit;
  if (moreRows) {
    result.rows.pop(); // taking off extra row, which was used as an indicator
  }

  if (isNaN(rel) && result.rows.length) {
    rel = result.rows[0].id;
  }

  const timeline = result.rows.map(row => {
    return {
      id: row.id,
      repo: row.repo_name,
      repo_private: row.repo_private,
      branch: row.branch,
      view: `${webConfig.protocol}://${row.url_uid}.view.${webConfig.host}`,
      logs: `${webConfig.protocol}://${row.url_uid}.logs.${webConfig.host}`,
      status: row.is_active === true && !row.active_start ? 'Spinning Up' :
        row.is_active === true && row.active_start ? 'Running' :
        row.is_active === false ? 'Spun Down' :
        'Unknown', // should not happen
      start: row.active_start || row.added,
      stop: row.active_stop
    };
  });

  const qs = require('qs');

  return res.send({
    timeline,
    paging: {
      prev: page === 0 ? null : `${config.app.api.url}/api/org/${orgName}/containers/timeline?${qs.stringify({
        page: page - 1,
        rel
      })}`,

      next: !moreRows ? null : `${config.app.api.url}/api/org/${orgName}/containers/timeline?${qs.stringify({
        page: page + 1,
        rel
      })}`
    },
    delta: `${config.app.api.url}/api/org/${orgName}/containers/timeline/new/count?${qs.stringify({
      rel: isNaN(rel) ? 0 : rel
    })}`
  });
});

module.exports = route;
