const Route = require('conjure-core/classes/Route');
const ContentError = require('conjure-core/modules/err').ContentError;
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;

const route = new Route({
  requireAuthentication: true
});

/*
  Repos listing
 */
route.push((req, res, next) => {
  const page = parseInt(req.query.page, 10);
  const limit = 20; // todo: config this?

  if (isNaN(page) || page < 0) {
    return next(new ContentError('Missing page number'));
  }

  const database = require('conjure-core/modules/database');

  const orgName = req.params.orgName;

  // todo: verify user has github access to this org

  database.query(`
    SELECT
      c.*,
      wr.name repo_name,
      wr.private repo_private
    FROM container c
    INNER JOIN watched_repo wr ON c.repo = wr.id
    WHERE c.repo IN (
      SELECT id FROM watched_repo WHERE org = $1
    )
    ORDER BY added DESC
    LIMIT ${limit}
    OFFSET ${page * limit}
  `, [orgName], (err, result) => {
    if (err) {
      return next(err);
    }

    // should not happen
    if (!Array.isArray(result.rows)) {
      return next(new UnexpectedError('No rows returned'));
    }

    const timeline = result.rows.map(row => {
      return {
        id: row.id,
        repo: row.repo_name,
        repo_private: row.repo_private,
        branch: row.branch,
        url: `${row.host}:${row.port}`,
        status: row.is_active === true && !row.active_start ? 'Spinning Up' :
          row.is_active === true && row.active_start ? 'Running' :
          row.is_active === false ? 'Spun Down' :
          'Unknown', // should not happen
        start: row.active_start,
        stop: row.active_stop
      };
    });

    res.send({
      timeline
    });
  });
});

module.exports = route;
