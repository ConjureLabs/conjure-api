const Route = require('conjure-core/classes/Route');
const ContentError = require('conjure-core/modules/err').ContentError;
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;
const config = require('conjure-core/modules/config');

const route = new Route({
  requireAuthentication: true
});

const webConfig = config.app.web;

/*
  New container timeline rows, since last reference (row id)
 */
route.push((req, res, next) => {
  let rel = parseInt(req.query.rel, 10); // required - is most recent row id in existing timeline

  if (isNaN(rel)) {
    return next(new ContentError('Missing `rel` (number)'));
  }

  const database = require('conjure-core/modules/database');

  // todo: verify user has github access to this org
  const orgName = req.params.orgName;

  database.query(`
    SELECT COUNT(*) num
    FROM container
    WHERE id > ${rel}
    AND repo IN (
      SELECT id FROM watched_repo WHERE org = $1
    )
  `, [orgName], (err, result) => {
    if (err) {
      return next(err);
    }

    // should not happen
    if (!Array.isArray(result.rows)) {
      return next(new UnexpectedError('No rows returned'));
    }

    res.send({
      count: result.rows[0].num
    });
  });
});

module.exports = route;
